import { resolveLocalDueMs } from '../core/duedate';
import { noteToCanonical, taskToCanonical } from '../core/mapping';
import { ApplyResult } from '../core/results';
import { Op, Pairing, SyncPlan } from '../core/model';
import { Clock, GoogleSide, JoplinSide } from '../ports';

type ExecuteArgs = {
	pair: Pairing;
	joplin: JoplinSide;
	google: GoogleSide;
	clock: Clock;
};

/**
 * What a run actually managed to apply. A failing op stops the run, but the
 * results collected so far are still returned so the caller can record them —
 * dropping them would leave work applied on one side with no link, which the
 * next run would re-apply as a duplicate.
 */
export type ExecuteOutcome = {
	results: ApplyResult[];
	failure?: { op: Op; error: unknown };
};

export async function executePlan(args: ExecuteArgs & { plan: SyncPlan }): Promise<ExecuteOutcome> {
	const results: ApplyResult[] = [];

	for (const op of args.plan.ops) {
		try {
			results.push(await applyOp(op, args));
		} catch (error) {
			return { results, failure: { op, error } };
		}
	}

	return { results };
}

async function applyOp(op: Op, args: ExecuteArgs): Promise<ApplyResult> {
	switch (op.type) {
		case 'CreateRemote': {
			const created = await args.google.createTask(args.pair.listId, op.task);
			const note = await args.joplin.getNote(op.noteId);
			let joplinUpdatedTime = note?.updatedTime ?? args.clock.now();
			let localDueMs = op.localDueMs;
			if (op.applyLocalTruncation) {
				const dueMs = resolveLocalDueMs({
					mergedDue: op.task.due,
					baseDue: op.task.due,
					localDueMs: op.localDueMs,
				});
				const updated = await args.joplin.updateTodo(op.noteId, op.task, dueMs);
				joplinUpdatedTime = updated.updatedTime;
				localDueMs = updated.todoDue;
			}
			return {
				kind: 'createdRemote',
				listId: args.pair.listId,
				noteId: op.noteId,
				taskId: created.id,
				base: taskToCanonical(created),
				localDueMs,
				joplinUpdatedTime,
				googleUpdated: created.updated,
				googleEtag: created.etag,
				googleParent: created.parent,
			};
		}
		case 'CreateLocal': {
			const dueMs = resolveLocalDueMs({
				mergedDue: op.task.due,
				baseDue: null,
				localDueMs: null,
			});
			const created = await args.joplin.createTodo(args.pair.folderId, op.task, dueMs);
			return {
				kind: 'createdLocal',
				listId: args.pair.listId,
				noteId: created.id,
				taskId: op.taskId,
				base: noteToCanonical(created),
				localDueMs: created.todoDue,
				joplinUpdatedTime: created.updatedTime,
				googleUpdated: op.googleUpdated,
				googleEtag: op.googleEtag,
				googleParent: op.googleParent,
			};
		}
		case 'UpdateLocal': {
			const updated = await args.joplin.updateTodo(op.noteId, op.task, op.localDueMs);
			return {
				kind: 'updatedLocal',
				listId: args.pair.listId,
				noteId: op.noteId,
				taskId: op.taskId,
				base: noteToCanonical(updated),
				localDueMs: updated.todoDue,
				joplinUpdatedTime: updated.updatedTime,
				googleUpdated: op.googleUpdated,
				googleEtag: op.googleEtag,
				googleParent: op.googleParent,
			};
		}
		case 'UpdateRemote': {
			const updated = await args.google.updateTask(args.pair.listId, op.taskId, op.task, op.etag);
			const note = await args.joplin.getNote(op.noteId);
			return {
				kind: 'updatedRemote',
				listId: args.pair.listId,
				noteId: op.noteId,
				taskId: op.taskId,
				base: taskToCanonical(updated),
				localDueMs: op.task.due === null ? null : (note?.todoDue ?? null),
				googleUpdated: updated.updated,
				googleEtag: updated.etag,
				googleParent: updated.parent,
			};
		}
		case 'DeleteLocal': {
			await args.joplin.deleteNote(op.noteId);
			return { kind: 'deletedLocal', noteId: op.noteId, taskId: op.taskId };
		}
		case 'DeleteRemote': {
			await args.google.deleteTask(args.pair.listId, op.taskId);
			return { kind: 'deletedRemote', noteId: op.noteId, taskId: op.taskId };
		}
		case 'WriteConflictNote': {
			const created = await args.joplin.createConflictNote(args.pair.folderId, op.title, op.body);
			return { kind: 'wroteConflictNote', noteId: created.id };
		}
	}
}
