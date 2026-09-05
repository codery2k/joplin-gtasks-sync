import { LinkState } from './model';
import { ApplyResult } from './results';

export function reconcile(links: LinkState[], results: ApplyResult[]): LinkState[] {
	const next = new Map(links.map((link) => [linkKey(link.noteId, link.taskId), { ...link }]));

	for (const result of results) {
		switch (result.kind) {
			case 'createdRemote': {
				const state: LinkState = {
					v: 1,
					listId: result.listId,
					taskId: result.taskId,
					noteId: result.noteId,
					base: result.base,
					localDueMs: result.localDueMs,
					joplinUpdatedTime: result.joplinUpdatedTime,
					googleUpdated: result.googleUpdated,
					googleEtag: result.googleEtag,
					googleParent: result.googleParent,
				};
				next.set(linkKey(state.noteId, state.taskId), state);
				break;
			}
			case 'createdLocal': {
				const state: LinkState = {
					v: 1,
					listId: result.listId,
					taskId: result.taskId,
					noteId: result.noteId,
					base: result.base,
					localDueMs: result.localDueMs,
					joplinUpdatedTime: result.joplinUpdatedTime,
					googleUpdated: result.googleUpdated,
					googleEtag: result.googleEtag,
					googleParent: result.googleParent,
				};
				next.set(linkKey(state.noteId, state.taskId), state);
				break;
			}
			case 'updatedLocal':
			case 'updatedRemote': {
				const existing =
					findLink(next, result.noteId, result.taskId) ??
					({
						v: 1 as const,
						listId: result.listId,
						taskId: result.taskId,
						noteId: result.noteId,
						base: result.base,
						localDueMs: result.localDueMs,
						joplinUpdatedTime: 0,
						googleUpdated: '',
					} satisfies LinkState);
				const merged: LinkState = {
					...existing,
					base: result.base,
					localDueMs: result.localDueMs,
				};
				if (result.kind === 'updatedLocal') {
					merged.joplinUpdatedTime = result.joplinUpdatedTime;
				}
				// Both directions observed the remote task, so both refresh it.
				merged.googleUpdated = result.googleUpdated;
				merged.googleEtag = result.googleEtag;
				merged.googleParent = result.googleParent;
				next.set(linkKey(merged.noteId, merged.taskId), merged);
				break;
			}
			case 'deletedLocal':
			case 'deletedRemote':
				removeLink(next, result.noteId, result.taskId);
				break;
			case 'wroteConflictNote':
				break;
		}
	}

	return [...next.values()];
}

function linkKey(noteId: string, taskId: string): string {
	return `${noteId}::${taskId}`;
}

function findLink(
	next: Map<string, LinkState>,
	noteId: string,
	taskId: string,
): LinkState | undefined {
	const exact = next.get(linkKey(noteId, taskId));
	if (exact) return exact;
	for (const link of next.values()) {
		if (link.noteId === noteId || link.taskId === taskId) return link;
	}
	return undefined;
}

function removeLink(next: Map<string, LinkState>, noteId: string, taskId: string): void {
	next.delete(linkKey(noteId, taskId));
	for (const [key, link] of next) {
		if (link.noteId === noteId || link.taskId === taskId) {
			next.delete(key);
		}
	}
}
