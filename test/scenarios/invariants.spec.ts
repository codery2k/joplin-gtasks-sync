import { describe, expect, it } from 'vitest';
import { GOOGLE_NOTES_MAX } from '../../src/core/model';
import { FakeClock } from '../fakes/clock';
import { InMemoryGoogleTasks } from '../fakes/memoryGoogle';
import { InMemoryJoplinSide } from '../fakes/memoryJoplin';
import { runSync } from '../fakes/runSync';

const pair = { folderId: 'folder', listId: 'list' };

function world() {
	const clock = new FakeClock(1_700_000_000_000);
	const joplin = new InMemoryJoplinSide(clock);
	const google = new InMemoryGoogleTasks(clock);
	joplin.addFolder({ id: 'folder', title: 'Todos' });
	google.addList({ id: 'list', title: 'My Tasks' });
	return { clock, joplin, google };
}

describe('sync invariants', () => {
	it('is idempotent and converges, and does not echo our own writes', async () => {
		const { clock, joplin, google } = world();
		joplin.addNote({
			id: 'n1',
			title: 'Buy milk',
			body: '2%',
			parentId: 'folder',
			isTodo: true,
			todoDue: Date.UTC(2024, 0, 15, 17, 45, 0),
			todoCompleted: null,
			updatedTime: clock.now(),
			deletedTime: null,
		});

		const first = await runSync({ pair, joplin, google, links: [], clock });
		expect(first.plan.ops.map((op) => op.type)).toEqual(['CreateRemote']);

		const second = await runSync({ pair, joplin, google, links: first.links, clock });
		expect(second.plan.ops).toEqual([]);

		const third = await runSync({ pair, joplin, google, links: second.links, clock });
		expect(third.plan.ops).toEqual([]);

		const remotes = await google.listTasks('list', { showCompleted: true, showHidden: true });
		expect(remotes).toHaveLength(1);
		expect(remotes[0]?.title).toBe('Buy milk');
		expect(joplin.notes.get('n1')?.todoDue).toBe(Date.UTC(2024, 0, 15, 17, 45, 0));
	});

	it('propagates a local-only edit and a remote-only edit without flipping the other side', async () => {
		const { clock, joplin, google } = world();
		const seeded = await seedLinked(clock, joplin, google);

		const local = joplin.notes.get(seeded.noteId)!;
		joplin.notes.set(seeded.noteId, { ...local, title: 'Buy oat milk', updatedTime: clock.now() });

		const afterLocal = await runSync({ pair, joplin, google, links: seeded.links, clock });
		expect(afterLocal.plan.ops.map((op) => op.type)).toEqual(['UpdateRemote']);
		const remote = (await google.listTasks('list', { showCompleted: true, showHidden: true }))[0];
		expect(remote?.title).toBe('Buy oat milk');
		expect(remote?.notes).toBe('2%');

		google.addTask('list', { ...remote!, notes: 'skim', updated: new Date(clock.now()).toISOString() });
		const afterRemote = await runSync({ pair, joplin, google, links: afterLocal.links, clock });
		expect(afterRemote.plan.ops.map((op) => op.type)).toEqual(['UpdateLocal']);
		expect(joplin.notes.get(seeded.noteId)?.body).toBe('skim');
		expect(joplin.notes.get(seeded.noteId)?.title).toBe('Buy oat milk');

		const quiet = await runSync({ pair, joplin, google, links: afterRemote.links, clock });
		expect(quiet.plan.ops).toEqual([]);
	});

	it('keeps both values when different fields change, and records the loser on a same-field clash', async () => {
		const { clock, joplin, google } = world();
		const seeded = await seedLinked(clock, joplin, google);

		const local = joplin.notes.get(seeded.noteId)!;
		joplin.notes.set(seeded.noteId, {
			...local,
			title: 'Local title',
			body: 'local body',
			updatedTime: clock.now(),
		});
		const remotes = await google.listTasks('list', { showCompleted: true, showHidden: true });
		google.addTask('list', {
			...remotes[0]!,
			title: 'Remote title',
			updated: new Date(clock.now() + 10_000).toISOString(),
		});

		const result = await runSync({ pair, joplin, google, links: seeded.links, clock });
		expect(result.plan.ops.some((op) => op.type === 'WriteConflictNote')).toBe(true);

		const note = joplin.notes.get(seeded.noteId)!;
		expect(note.title).toBe('Remote title');
		expect(note.body).toBe('local body');

		const conflict = [...joplin.notes.values()].find((item) => item.title.startsWith('[gtasks conflict]'));
		expect(conflict?.isTodo).toBe(false);
		expect(conflict?.body).toContain('Local title');

		const remotesAfter = await google.listTasks('list', { showCompleted: true, showHidden: true });
		expect(remotesAfter[0]?.title).toBe('Remote title');
		expect(remotesAfter[0]?.notes).toBe('local body');
	});

	it('converges after a todo is completed locally', async () => {
		const { clock, joplin, google } = world();
		const seeded = await seedLinked(clock, joplin, google);

		clock.set(clock.now() + 10_000);
		const local = joplin.notes.get(seeded.noteId)!;
		joplin.notes.set(seeded.noteId, {
			...local,
			todoCompleted: clock.now(),
			updatedTime: clock.now(),
		});

		const push = await runSync({ pair, joplin, google, links: seeded.links, clock });
		expect(push.plan.ops.map((op) => op.type)).toEqual(['UpdateRemote']);
		const remote = (await google.listTasks('list', { showCompleted: true, showHidden: true }))[0];
		expect(remote?.status).toBe('completed');

		const quiet = await runSync({ pair, joplin, google, links: push.links, clock });
		expect(quiet.plan.ops).toEqual([]);
	});

	it('converges after a todo is completed remotely', async () => {
		const { clock, joplin, google } = world();
		const seeded = await seedLinked(clock, joplin, google);

		clock.set(clock.now() + 10_000);
		const remote = (await google.listTasks('list', { showCompleted: true, showHidden: true }))[0]!;
		google.addTask('list', {
			...remote,
			status: 'completed',
			completed: new Date(clock.now()).toISOString(),
			updated: new Date(clock.now()).toISOString(),
		});

		const pull = await runSync({ pair, joplin, google, links: seeded.links, clock });
		expect(pull.plan.ops.map((op) => op.type)).toEqual(['UpdateLocal']);
		expect(joplin.notes.get(seeded.noteId)?.todoCompleted).toBeTruthy();

		const quiet = await runSync({ pair, joplin, google, links: pull.links, clock });
		expect(quiet.plan.ops).toEqual([]);
	});

	it('does not resurrect a delete on either side', async () => {
		const { clock, joplin, google } = world();
		const seeded = await seedLinked(clock, joplin, google);

		await joplin.deleteNote(seeded.noteId);
		const afterLocalDelete = await runSync({ pair, joplin, google, links: seeded.links, clock });
		expect(afterLocalDelete.plan.ops.map((op) => op.type)).toEqual(['DeleteRemote']);
		const remotes = await google.listTasks('list', { showDeleted: true, showHidden: true, showCompleted: true });
		expect(remotes[0]?.deleted).toBe(true);

		const quiet = await runSync({ pair, joplin, google, links: afterLocalDelete.links, clock });
		expect(quiet.plan.ops).toEqual([]);
		expect(joplin.notes.get(seeded.noteId)?.deletedTime).not.toBeNull();

		const again = await seedLinked(clock, joplin, google, 'n2');
		await google.deleteTask('list', again.taskId);
		const afterRemoteDelete = await runSync({ pair, joplin, google, links: again.links, clock });
		expect(afterRemoteDelete.plan.ops.map((op) => op.type)).toEqual(['DeleteLocal']);
		expect(joplin.notes.get(again.noteId)?.deletedTime).not.toBeNull();
		const quiet2 = await runSync({ pair, joplin, google, links: afterRemoteDelete.links, clock });
		expect(quiet2.plan.ops).toEqual([]);
	});

	it('truncates a long body, reports the discarded text, and does not churn next round', async () => {
		const { clock, joplin, google } = world();
		const body = `keep${'x'.repeat(GOOGLE_NOTES_MAX)}TAIL`;
		joplin.addNote({
			id: 'long',
			title: 'Essay',
			body,
			parentId: 'folder',
			isTodo: true,
			todoDue: null,
			todoCompleted: null,
			updatedTime: clock.now(),
			deletedTime: null,
		});

		const first = await runSync({ pair, joplin, google, links: [], clock });
		expect(first.plan.ops.some((op) => op.type === 'WriteConflictNote')).toBe(true);
		const remotes = await google.listTasks('list', { showCompleted: true, showHidden: true });
		expect(remotes[0]?.notes).toHaveLength(GOOGLE_NOTES_MAX);
		expect(joplin.notes.get('long')?.body).toHaveLength(GOOGLE_NOTES_MAX);

		const conflict = [...joplin.notes.values()].find((item) => item.title.startsWith('[gtasks conflict]'));
		expect(conflict?.body).toContain('TAIL');

		const second = await runSync({ pair, joplin, google, links: first.links, clock });
		expect(second.plan.ops).toEqual([]);
	});
});

async function seedLinked(
	clock: FakeClock,
	joplin: InMemoryJoplinSide,
	google: InMemoryGoogleTasks,
	noteId = 'n1',
) {
	joplin.addNote({
		id: noteId,
		title: 'Buy milk',
		body: '2%',
		parentId: 'folder',
		isTodo: true,
		todoDue: Date.UTC(2024, 0, 15, 17, 45, 0),
		todoCompleted: null,
		updatedTime: clock.now(),
		deletedTime: null,
	});
	const first = await runSync({ pair, joplin, google, links: [], clock });
	const remotes = await google.listTasks('list', { showCompleted: true, showHidden: true });
	const task = remotes.find((item) => item.title === 'Buy milk' && !item.deleted);
	return { links: first.links, noteId, taskId: task?.id ?? first.links[0]!.taskId };
}
