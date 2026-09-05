import { describe, expect, it } from 'vitest';
import { plainDateToNoonUtcMs } from '../../src/core/duedate';
import {
	canonicalToGoogleFields,
	canonicalToNoteFields,
	noteToCanonical,
	taskToCanonical,
	truncateForGoogle,
} from '../../src/core/mapping';
import { GOOGLE_NOTES_MAX, GOOGLE_TITLE_MAX, JoplinNote } from '../../src/core/model';

const NOTE: JoplinNote = {
	id: 'n1',
	title: 'Buy milk',
	body: '2%',
	parentId: 'folder',
	isTodo: true,
	todoDue: Date.UTC(2024, 0, 15, 17, 45, 0),
	todoCompleted: null,
	updatedTime: 1000,
	deletedTime: null,
};

describe('mapping', () => {
	it('normalises completion timestamps to whole seconds', () => {
		// Google stores `completed` at second precision, so the canonical form must
		// not carry milliseconds the wire format cannot round-trip.
		const canonical = noteToCanonical({ ...NOTE, todoCompleted: 1_700_000_500_123 });
		expect(canonical.completed).toBe(true);
		expect(canonical.completedAt).toBe(1_700_000_500_000);

		const fromTask = taskToCanonical({
			id: 't1',
			status: 'completed',
			completed: '2023-11-14T22:21:40.123Z',
			updated: '2023-11-14T22:21:40.000Z',
		});
		expect(fromTask.completedAt).toBe(Date.parse('2023-11-14T22:21:40.000Z'));
	});

	it('round-trips a representable note through canonical fields', () => {
		const canonical = noteToCanonical(NOTE);
		expect(canonical).toEqual({
			title: 'Buy milk',
			body: '2%',
			due: '2024-01-15',
			completed: false,
			completedAt: null,
		});

		const fields = canonicalToNoteFields(canonical, NOTE.todoDue, 9999);
		expect(fields).toEqual({
			title: 'Buy milk',
			body: '2%',
			isTodo: true,
			todoDue: NOTE.todoDue,
			todoCompleted: null,
		});
	});

	it('maps completed notes and tasks', () => {
		const completedAt = Date.UTC(2024, 0, 16, 9, 0, 0);
		const canonical = noteToCanonical({ ...NOTE, todoCompleted: completedAt });
		expect(canonical.completed).toBe(true);
		expect(canonical.completedAt).toBe(completedAt);

		const fromTask = taskToCanonical({
			id: 't1',
			title: 'Buy milk',
			notes: '2%',
			status: 'completed',
			completed: new Date(completedAt).toISOString(),
			updated: new Date(completedAt).toISOString(),
		});
		expect(fromTask.completed).toBe(true);
		expect(fromTask.completedAt).toBe(completedAt);
	});

	it('treats missing or zero Joplin due/completed as open with no due', () => {
		expect(noteToCanonical({ ...NOTE, todoDue: 0, todoCompleted: 0 })).toMatchObject({
			due: null,
			completed: false,
			completedAt: null,
		});
		expect(noteToCanonical({ ...NOTE, todoDue: null, todoCompleted: null })).toMatchObject({
			due: null,
			completed: false,
			completedAt: null,
		});
	});

	it('drops the time portion of a Google due', () => {
		const canonical = taskToCanonical({
			id: 't1',
			title: 'Buy milk',
			status: 'needsAction',
			due: '2024-01-15T00:00:00.000Z',
			updated: '2024-01-15T00:00:00.000Z',
		});
		expect(canonical.due).toBe('2024-01-15');
		expect(canonicalToGoogleFields(canonical).due).toBe('2024-01-15T00:00:00.000Z');
	});

	it('fills completedAt with now when applying a completed task that has no timestamp', () => {
		const now = 1_700_000_000_000;
		const fields = canonicalToNoteFields(
			{ title: 'X', body: '', due: null, completed: true, completedAt: null },
			null,
			now,
		);
		expect(fields.todoCompleted).toBe(now);
	});

	it('uses noon UTC when writing a due that has no preserved local time', () => {
		const fields = canonicalToNoteFields(
			{ title: 'X', body: '', due: '2024-01-15', completed: false, completedAt: null },
			plainDateToNoonUtcMs('2024-01-15'),
			0,
		);
		expect(fields.todoDue).toBe(plainDateToNoonUtcMs('2024-01-15'));
	});

	it('truncates Google title and body and reports it', () => {
		const title = 'T'.repeat(GOOGLE_TITLE_MAX + 10);
		const body = 'B'.repeat(GOOGLE_NOTES_MAX + 25);
		const { task, truncations } = truncateForGoogle({
			title,
			body,
			due: null,
			completed: false,
			completedAt: null,
		});
		expect(task.title).toHaveLength(GOOGLE_TITLE_MAX);
		expect(task.body).toHaveLength(GOOGLE_NOTES_MAX);
		expect(truncations).toEqual([
			{
				field: 'title',
				originalLength: title.length,
				truncatedLength: GOOGLE_TITLE_MAX,
				discarded: title.slice(GOOGLE_TITLE_MAX),
			},
			{
				field: 'body',
				originalLength: body.length,
				truncatedLength: GOOGLE_NOTES_MAX,
				discarded: body.slice(GOOGLE_NOTES_MAX),
			},
		]);

		const fields = canonicalToGoogleFields({
			title,
			body,
			due: null,
			completed: false,
			completedAt: null,
		});
		expect(fields.truncations).toHaveLength(2);
		expect(fields.title).toHaveLength(GOOGLE_TITLE_MAX);
	});
});
