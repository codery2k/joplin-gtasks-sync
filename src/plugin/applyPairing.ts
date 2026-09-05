import { FolderPairing, GoogleTaskList } from '../core/model';
import { FolderInfo, JoplinSide } from '../ports';
import { PairingRequest } from './dialogs/pairingForm';

export type PairingStore = {
	getPairing(folderId: string): Promise<FolderPairing | null>;
	setPairing(folderId: string, pairing: FolderPairing): Promise<void>;
};

export type AppliedPair = { folderId: string; listTitle: string };

export async function applyPairing(args: {
	request: PairingRequest;
	lists: GoogleTaskList[];
	joplin: JoplinSide;
	store: PairingStore;
}): Promise<{ pairs: AppliedPair[] }> {
	if (args.request.kind === 'all') {
		return { pairs: await pairAllLists(args.lists, args.joplin, args.store) };
	}

	const folder =
		args.request.notebook.kind === 'existing'
			? { id: args.request.notebook.folderId, title: '' }
			: await args.joplin.createFolder(args.request.notebook.title);
	await writePairing(args.store, folder.id, args.request.listId, args.request.listTitle);
	return { pairs: [{ folderId: folder.id, listTitle: args.request.listTitle }] };
}

async function pairAllLists(
	lists: GoogleTaskList[],
	joplin: JoplinSide,
	store: PairingStore,
): Promise<AppliedPair[]> {
	const folders = [...(await joplin.listFolders())];
	const pairs: AppliedPair[] = [];

	for (const list of lists) {
		const already = await folderPairedToList(folders, store, list.id);
		const folder = already ?? (await folderForNewList(folders, store, joplin, list.title));
		await writePairing(store, folder.id, list.id, list.title);
		pairs.push({ folderId: folder.id, listTitle: list.title });
	}

	return pairs;
}

async function folderPairedToList(
	folders: FolderInfo[],
	store: PairingStore,
	listId: string,
): Promise<FolderInfo | undefined> {
	for (const folder of folders) {
		const pairing = await store.getPairing(folder.id);
		if (pairing?.listId === listId) return folder;
	}
	return undefined;
}

async function folderForNewList(
	folders: FolderInfo[],
	store: PairingStore,
	joplin: JoplinSide,
	title: string,
): Promise<FolderInfo> {
	for (const folder of folders) {
		if (folder.title !== title) continue;
		if (!(await store.getPairing(folder.id))) return folder;
	}
	const created = await joplin.createFolder(title);
	folders.push(created);
	return created;
}

async function writePairing(
	store: PairingStore,
	folderId: string,
	listId: string,
	listTitle: string,
): Promise<void> {
	const existing = await store.getPairing(folderId);
	await store.setPairing(folderId, {
		v: 1,
		listId,
		listTitle,
		links: existing?.links ?? [],
	});
}
