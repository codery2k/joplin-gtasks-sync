import joplin from 'api';
import { ModelType } from 'api/types';
import { FolderPairing, LinkState, USERDATA_LINK_KEY, USERDATA_PAIR_KEY } from '../core/model';

const emptyPairing = (listId: string, listTitle?: string): FolderPairing => ({
	v: 1,
	listId,
	listTitle,
	links: [],
});

export class LinkStore {
	async getPairing(folderId: string): Promise<FolderPairing | null> {
		const value = await joplin.data.userDataGet<FolderPairing>(
			ModelType.Folder,
			folderId,
			USERDATA_PAIR_KEY,
		);
		if (!value || value.v !== 1 || !value.listId) return null;
		return { ...emptyPairing(value.listId, value.listTitle), ...value, links: value.links ?? [] };
	}

	async setPairing(folderId: string, pairing: FolderPairing): Promise<void> {
		await joplin.data.userDataSet(ModelType.Folder, folderId, USERDATA_PAIR_KEY, pairing);
	}

	async clearPairing(folderId: string): Promise<void> {
		await joplin.data.userDataDelete(ModelType.Folder, folderId, USERDATA_PAIR_KEY);
	}

	async loadLinks(folderId: string, listId: string): Promise<LinkState[]> {
		const pairing = await this.getPairing(folderId);
		const index = pairing?.links ?? [];
		const links: LinkState[] = [];
		for (const ref of index) {
			const stored = await joplin.data.userDataGet<LinkState>(
				ModelType.Note,
				ref.noteId,
				USERDATA_LINK_KEY,
			);
			if (stored && stored.v === 1) {
				links.push(stored);
			} else {
				links.push({
					v: 1,
					listId,
					taskId: ref.taskId,
					noteId: ref.noteId,
					base: { title: '', body: '', due: null, completed: false, completedAt: null },
					localDueMs: null,
					joplinUpdatedTime: 0,
					googleUpdated: '',
				});
			}
		}
		return links;
	}

	async saveLinks(folderId: string, listId: string, links: LinkState[]): Promise<void> {
		const pairing = (await this.getPairing(folderId)) ?? emptyPairing(listId);
		pairing.listId = listId;
		pairing.links = links.map((link) => ({ noteId: link.noteId, taskId: link.taskId }));
		await this.setPairing(folderId, pairing);

		for (const link of links) {
			await joplin.data.userDataSet(ModelType.Note, link.noteId, USERDATA_LINK_KEY, link);
		}
	}
}
