import { msToPlainDate, googleDueToPlainDate, plainDateToGoogleDue } from './duedate';
import {
	CanonicalTask,
	GOOGLE_NOTES_MAX,
	GOOGLE_TITLE_MAX,
	GoogleTask,
	JoplinNote,
	TruncationReport,
} from './model';

/**
 * Google Tasks stores `completed` at whole-second precision. Joplin's
 * todoCompleted is milliseconds, so an un-normalised value would differ from
 * whatever the server echoes back on every round and re-push forever. Drop the
 * sub-second part at the canonical boundary so both sides agree.
 */
function toWholeSecondMs(ms: number): number {
	return Math.floor(ms / 1000) * 1000;
}

export function noteToCanonical(note: JoplinNote): CanonicalTask {
	const completedAt = note.todoCompleted !== null && note.todoCompleted > 0 ? note.todoCompleted : null;
	return {
		title: note.title,
		body: note.body,
		due: note.todoDue !== null && note.todoDue > 0 ? msToPlainDate(note.todoDue) : null,
		completed: completedAt !== null,
		completedAt: completedAt === null ? null : toWholeSecondMs(completedAt),
	};
}

export function canonicalToNoteFields(
	task: CanonicalTask,
	dueMs: number | null,
	now: number,
): Pick<JoplinNote, 'title' | 'body' | 'isTodo' | 'todoDue' | 'todoCompleted'> {
	return {
		title: task.title,
		body: task.body,
		isTodo: true,
		todoDue: dueMs,
		todoCompleted: task.completed ? (task.completedAt ?? now) : null,
	};
}

export function taskToCanonical(task: GoogleTask): CanonicalTask {
	const completed = task.status === 'completed';
	let completedAt: number | null = null;
	if (completed && task.completed) {
		const parsed = Date.parse(task.completed);
		completedAt = Number.isNaN(parsed) ? null : toWholeSecondMs(parsed);
	}
	return {
		title: task.title ?? '',
		body: task.notes ?? '',
		due: task.due ? googleDueToPlainDate(task.due) : null,
		completed,
		completedAt,
	};
}

export function truncateForGoogle(task: CanonicalTask): {
	task: CanonicalTask;
	truncations: TruncationReport[];
} {
	const truncations: TruncationReport[] = [];
	let { title, body } = task;
	if (title.length > GOOGLE_TITLE_MAX) {
		truncations.push({
			field: 'title',
			originalLength: title.length,
			truncatedLength: GOOGLE_TITLE_MAX,
			discarded: title.slice(GOOGLE_TITLE_MAX),
		});
		title = title.slice(0, GOOGLE_TITLE_MAX);
	}
	if (body.length > GOOGLE_NOTES_MAX) {
		truncations.push({
			field: 'body',
			originalLength: body.length,
			truncatedLength: GOOGLE_NOTES_MAX,
			discarded: body.slice(GOOGLE_NOTES_MAX),
		});
		body = body.slice(0, GOOGLE_NOTES_MAX);
	}
	return { task: { ...task, title, body }, truncations };
}

export function canonicalToGoogleFields(task: CanonicalTask): {
	title: string;
	notes: string;
	status: 'needsAction' | 'completed';
	due: string | null;
	completed: string | null;
	truncations: TruncationReport[];
} {
	const { task: truncated, truncations } = truncateForGoogle(task);
	return {
		title: truncated.title,
		notes: truncated.body,
		status: truncated.completed ? 'completed' : 'needsAction',
		due: truncated.due ? plainDateToGoogleDue(truncated.due) : null,
		completed:
			truncated.completed && truncated.completedAt !== null
				? new Date(truncated.completedAt).toISOString()
				: null,
		truncations,
	};
}

export function canonicalEquals(a: CanonicalTask, b: CanonicalTask): boolean {
	return (
		a.title === b.title &&
		a.body === b.body &&
		a.due === b.due &&
		a.completed === b.completed &&
		a.completedAt === b.completedAt
	);
}
