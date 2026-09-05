import { resolveLocalDueMs } from '../core/duedate';
import { noteToCanonical, taskToCanonical } from '../core/mapping';
import { ApplyResult } from '../core/results';
import { Pairing, SyncPlan } from '../core/model';
import { Clock, GoogleSide, JoplinSide } from '../ports';

export async function executePlan(args: {
	pair: Pairing;
	plan: SyncPlan;
	joplin: JoplinSide;
	google: GoogleSide;
	clock: Clock;
}): Promise<ApplyResult[]> {
	const results: ApplyResult[] = [];

	for (const op of args.plan.ops) {
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
				results.push({
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
				});
				break;
			}
			case 'CreateLocal': {
				const dueMs = resolveLocalDueMs({
					mergedDue: op.task.due,
					baseDue: null,
					localDueMs: null,
				});
				const created = await args.joplin.createTodo(args.pair.folderId, op.task, dueMs);
				results.push({
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
				});
				break;
			}
			case 'UpdateLocal': {
				const updated = await args.joplin.updateTodo(op.noteId, op.task, op.localDueMs);
				results.push({
					kind: 'updatedLocal',
					listId: args.pair.listId,
					noteId: op.noteId,
					taskId: op.taskId,
					base: noteToCanonical(updated),
					localDueMs: updated.todoDue,
					joplinUpdatedTime: updated.updatedTime,
				});
				break;
			}
			case 'UpdateRemote': {
				const updated = await args.google.updateTask(
					args.pair.listId,
					op.taskId,
					op.task,
					op.etag,
				);
				const note = await args.joplin.getNote(op.noteId);
				results.push({
					kind: 'updatedRemote',
					listId: args.pair.listId,
					noteId: op.noteId,
					taskId: op.taskId,
					base: taskToCanonical(updated),
					localDueMs: op.task.due === null ? null : (note?.todoDue ?? null),
					googleUpdated: updated.updated,
					googleEtag: updated.etag,
					googleParent: updated.parent,
				});
				break;
			}
			case 'DeleteLocal': {
				await args.joplin.deleteNote(op.noteId);
				results.push({ kind: 'deletedLocal', noteId: op.noteId, taskId: op.taskId });
				break;
			}
			case 'DeleteRemote': {
				await args.google.deleteTask(args.pair.listId, op.taskId);
				results.push({ kind: 'deletedRemote', noteId: op.noteId, taskId: op.taskId });
				break;
			}
			case 'WriteConflictNote': {
				const created = await args.joplin.createConflictNote(
					args.pair.folderId,
					op.title,
					op.body,
				);
				results.push({ kind: 'wroteConflictNote', noteId: created.id });
				break;
			}
		}
	}

	return results;
}
