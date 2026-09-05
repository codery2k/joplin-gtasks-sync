import { describe, expect, it } from 'vitest';
import { CanonicalTask, GoogleTask } from '../../src/core/model';
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

describe('a failure part-way through a plan', () => {
	it('keeps the links for the ops that already succeeded, so the retry does not duplicate them', async () => {
		const { clock, joplin, google } = world();
		for (const id of ['n1', 'n2']) {
			joplin.addNote({
				id,
				title: `Task ${id}`,
				body: '',
				parentId: 'folder',
				isTodo: true,
				todoDue: null,
				todoCompleted: null,
				updatedTime: clock.now(),
				deletedTime: null,
			});
		}

		// The second create fails, after the first has already reached the server.
		const realCreate = google.createTask.bind(google);
		let creates = 0;
		google.createTask = async (listId: string, task: CanonicalTask): Promise<GoogleTask> => {
			creates += 1;
			if (creates === 2) throw new Error('network blip');
			return realCreate(listId, task);
		};

		const failed = await runSync({ pair, joplin, google, links: [], clock, tolerateFailure: true });
		expect(failed.failure?.op.type).toBe('CreateRemote');
		expect(failed.links).toHaveLength(1);

		google.createTask = realCreate;
		await runSync({ pair, joplin, google, links: failed.links, clock });

		const titles = (await google.listTasks('list', { showCompleted: true, showHidden: true }))
			.map((task) => task.title)
			.sort();
		expect(titles).toEqual(['Task n1', 'Task n2']);
	});

	it('still surfaces the failure to the caller by default', async () => {
		const { clock, joplin, google } = world();
		joplin.addNote({
			id: 'n1',
			title: 'Task n1',
			body: '',
			parentId: 'folder',
			isTodo: true,
			todoDue: null,
			todoCompleted: null,
			updatedTime: clock.now(),
			deletedTime: null,
		});
		google.createTask = async () => {
			throw new Error('network blip');
		};
		await expect(runSync({ pair, joplin, google, links: [], clock })).rejects.toThrow('network blip');
	});
});
