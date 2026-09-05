import { describe, expect, it } from 'vitest';
import { plan } from '../../src/core/planner';
import { CanonicalTask, GoogleTask, JoplinNote, LinkState } from '../../src/core/model';

const pair = { folderId: 'folder', listId: 'list' };

const base: CanonicalTask = {
	title: 'Buy milk',
	body: '2%',
	due: '2024-01-15',
	completed: false,
	completedAt: null,
};

function note(partial: Partial<JoplinNote> = {}): JoplinNote {
	return {
		id: 'n1',
		title: 'Buy milk',
		body: '2%',
		parentId: 'folder',
		isTodo: true,
		todoDue: Date.UTC(2024, 0, 15, 17, 45, 0),
		todoCompleted: null,
		updatedTime: 100,
		deletedTime: null,
		...partial,
	};
}

function task(partial: Partial<GoogleTask> = {}): GoogleTask {
	return {
		id: 't1',
		title: 'Buy milk',
		notes: '2%',
		status: 'needsAction',
		due: '2024-01-15T00:00:00.000Z',
		updated: '2024-01-15T00:00:00.000Z',
		etag: '"e1"',
		...partial,
	};
}

function link(partial: Partial<LinkState> = {}): LinkState {
	return {
		v: 1,
		listId: 'list',
		taskId: 't1',
		noteId: 'n1',
		base,
		localDueMs: Date.UTC(2024, 0, 15, 17, 45, 0),
		joplinUpdatedTime: 100,
		googleUpdated: '2024-01-15T00:00:00.000Z',
		googleEtag: '"e1"',
		...partial,
	};
}

describe('planner', () => {
	it('creates a remote task for an unlinked local todo', () => {
		const result = plan({
			pair,
			localNotes: [note()],
			remoteTasks: [],
			links: [],
			now: 1,
		});
		expect(result.ops).toMatchObject([{ type: 'CreateRemote', noteId: 'n1' }]);
	});

	it('creates a local todo for an unlinked remote task', () => {
		const result = plan({
			pair,
			localNotes: [],
			remoteTasks: [task()],
			links: [],
			now: 1,
		});
		expect(result.ops).toMatchObject([{ type: 'CreateLocal', taskId: 't1' }]);
	});

	it('is empty when both sides still match the base', () => {
		const result = plan({
			pair,
			localNotes: [note()],
			remoteTasks: [task()],
			links: [link()],
			now: 1,
		});
		expect(result.ops).toEqual([]);
	});

	it('does not treat a Google due time-of-day as a remote change', () => {
		const result = plan({
			pair,
			localNotes: [note()],
			remoteTasks: [task({ due: '2024-01-15T23:59:59.000Z', updated: '2024-01-16T00:00:00.000Z' })],
			links: [link()],
			now: 1,
		});
		expect(result.ops).toEqual([]);
	});

	it('deletes the remote task when the linked note is gone', () => {
		const result = plan({
			pair,
			localNotes: [note({ deletedTime: 500 })],
			remoteTasks: [task()],
			links: [link()],
			now: 1,
		});
		expect(result.ops).toMatchObject([{ type: 'DeleteRemote', taskId: 't1' }]);
	});

	it('deletes the local note when the linked task is deleted', () => {
		const result = plan({
			pair,
			localNotes: [note()],
			remoteTasks: [task({ deleted: true })],
			links: [link()],
			now: 1,
		});
		expect(result.ops).toMatchObject([{ type: 'DeleteLocal', noteId: 'n1' }]);
	});

	it('merges different-field edits onto both sides', () => {
		const result = plan({
			pair,
			localNotes: [note({ title: 'Buy oat milk', updatedTime: 200 })],
			remoteTasks: [task({ notes: 'skim', updated: '2024-01-16T00:00:00.000Z' })],
			links: [link()],
			now: 1,
		});
		expect(result.ops.map((op) => op.type).sort()).toEqual(['UpdateLocal', 'UpdateRemote']);
	});

	it('writes a conflict note on a same-field clash', () => {
		const result = plan({
			pair,
			localNotes: [note({ title: 'Local', updatedTime: 200 })],
			remoteTasks: [task({ title: 'Remote', updated: '2024-01-20T00:00:00.000Z' })],
			links: [link()],
			now: 1,
		});
		expect(result.ops.some((op) => op.type === 'WriteConflictNote')).toBe(true);
		const conflict = result.ops.find((op) => op.type === 'WriteConflictNote');
		expect(conflict).toMatchObject({ kind: 'conflict' });
	});
});
