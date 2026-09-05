import { resolveLocalDueMs } from './duedate';
import { diff, hasChanges } from './diff';
import { conflictNoteTitle, formatConflictBody, formatTruncationBody } from './conflictNote';
import { merge } from './merge';
import { canonicalEquals, noteToCanonical, taskToCanonical, truncateForGoogle } from './mapping';
import {
	GoogleTask,
	JoplinNote,
	LinkState,
	Op,
	Pairing,
	SyncPlan,
	WriteConflictNoteOp,
} from './model';

export function plan(args: {
	pair: Pairing;
	localNotes: JoplinNote[];
	remoteTasks: GoogleTask[];
	links: LinkState[];
	now: number;
}): SyncPlan {
	const todos = args.localNotes.filter((note) => note.isTodo && !note.deletedTime);
	const notesById = new Map(args.localNotes.map((note) => [note.id, note]));
	const tasksById = new Map(args.remoteTasks.map((task) => [task.id, task]));
	const linksForPair = args.links.filter((link) => link.listId === args.pair.listId);
	const linkedNoteIds = new Set(linksForPair.map((link) => link.noteId));
	const linkedTaskIds = new Set(linksForPair.map((link) => link.taskId));
	const ops: Op[] = [];

	for (const link of linksForPair) {
		const note = notesById.get(link.noteId);
		const task = tasksById.get(link.taskId);
		const localGone = !note || !!note.deletedTime || !note.isTodo;
		const remoteGone = !task || task.deleted === true;

		if (localGone && remoteGone) {
			continue;
		}

		if (localGone && !remoteGone) {
			ops.push({ type: 'DeleteRemote', noteId: link.noteId, taskId: link.taskId });
			continue;
		}

		if (remoteGone && !localGone) {
			ops.push({ type: 'DeleteLocal', noteId: link.noteId, taskId: link.taskId });
			continue;
		}

		if (!note || !task) continue;

		const localCanonical = isLocalEcho(note, link) ? link.base : noteToCanonical(note);
		const remoteCanonical = isRemoteEcho(task, link) ? link.base : taskToCanonical(task);
		const localChanges = diff(link.base, localCanonical);
		const remoteChanges = diff(link.base, remoteCanonical);

		if (!hasChanges(localChanges) && !hasChanges(remoteChanges)) {
			continue;
		}

		const remoteUpdated = Date.parse(task.updated);
		const merged = merge({
			base: link.base,
			local: localCanonical,
			remote: remoteCanonical,
			localUpdated: note.updatedTime,
			remoteUpdated: Number.isNaN(remoteUpdated) ? 0 : remoteUpdated,
		});

		const { task: agreed, truncations } = truncateForGoogle(merged.merged);
		const localDueMs = resolveLocalDueMs({
			mergedDue: agreed.due,
			baseDue: link.base.due,
			localDueMs: link.localDueMs,
		});

		const pushRemote = hasChanges(diff(remoteCanonical, agreed));
		const pushLocal = hasChanges(diff(localCanonical, agreed));

		if (pushRemote) {
			ops.push({
				type: 'UpdateRemote',
				noteId: note.id,
				taskId: task.id,
				task: agreed,
				fields: merged.localWins,
				etag: link.googleEtag,
				truncations,
			});
		}

		if (pushLocal) {
			ops.push({
				type: 'UpdateLocal',
				noteId: note.id,
				taskId: task.id,
				task: agreed,
				fields: merged.remoteWins,
				localDueMs,
			});
		}

		if (merged.conflicts.length > 0) {
			ops.push({
				type: 'WriteConflictNote',
				noteId: note.id,
				taskId: task.id,
				kind: 'conflict',
				conflicts: merged.conflicts,
				title: conflictNoteTitle(note.title),
				body: formatConflictBody({ sourceTitle: note.title, conflicts: merged.conflicts }),
			});
		}

		if (truncations.length > 0) {
			ops.push(truncationOp(note.title, note.id, task.id, truncations));
		}
	}

	for (const note of todos) {
		if (linkedNoteIds.has(note.id)) continue;
		const canonical = noteToCanonical(note);
		const { task, truncations } = truncateForGoogle(canonical);
		ops.push({
			type: 'CreateRemote',
			noteId: note.id,
			task,
			localDueMs: note.todoDue !== null && note.todoDue > 0 ? note.todoDue : null,
			truncations,
			applyLocalTruncation: truncations.length > 0,
		});
		if (truncations.length > 0) {
			ops.push(truncationOp(note.title, note.id, undefined, truncations));
		}
	}

	for (const task of args.remoteTasks) {
		if (linkedTaskIds.has(task.id)) continue;
		if (task.deleted) continue;
		ops.push({
			type: 'CreateLocal',
			taskId: task.id,
			task: taskToCanonical(task),
			googleUpdated: task.updated,
			googleEtag: task.etag,
			googleParent: task.parent,
		});
	}

	return { ops };
}

function isLocalEcho(note: JoplinNote, link: LinkState): boolean {
	if (note.updatedTime === link.joplinUpdatedTime) return true;
	return canonicalEquals(noteToCanonical(note), link.base);
}

function isRemoteEcho(task: GoogleTask, link: LinkState): boolean {
	if (task.updated === link.googleUpdated) return true;
	return canonicalEquals(taskToCanonical(task), link.base);
}

function truncationOp(
	sourceTitle: string,
	noteId: string,
	taskId: string | undefined,
	truncations: WriteConflictNoteOp['truncations'],
): WriteConflictNoteOp {
	return {
		type: 'WriteConflictNote',
		noteId,
		taskId,
		kind: 'truncation',
		truncations,
		title: conflictNoteTitle(sourceTitle),
		body: formatTruncationBody({ sourceTitle, truncations: truncations ?? [] }),
	};
}
