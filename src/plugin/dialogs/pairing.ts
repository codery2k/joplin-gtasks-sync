import joplin from 'api';
import { GoogleTaskList } from '../../core/model';
import { FolderInfo } from '../../ports';

export async function pickPairing(args: {
	folders: FolderInfo[];
	lists: GoogleTaskList[];
}): Promise<{ folderId: string; listId: string; listTitle: string } | null> {
	const handle = await joplin.views.dialogs.create(`gtasksPairingDialog-${Date.now()}`);
	const folderOptions = args.folders
		.map((folder) => `<option value="${escapeHtml(folder.id)}">${escapeHtml(folder.title)}</option>`)
		.join('');
	const listOptions = args.lists
		.map((list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.title)}</option>`)
		.join('');

	await joplin.views.dialogs.setHtml(
		handle,
		`<form name="pair">
			<p>Pair a Joplin notebook with a Google task list.</p>
			<label>Notebook<br><select name="folderId">${folderOptions}</select></label>
			<br><br>
			<label>Task list<br><select name="listId">${listOptions}</select></label>
		</form>`,
	);
	await joplin.views.dialogs.setButtons(handle, [
		{ id: 'ok', title: 'Pair' },
		{ id: 'cancel', title: 'Cancel' },
	]);

	const result = await joplin.views.dialogs.open(handle);
	if (result.id !== 'ok') return null;
	const folderId = String(result.formData?.pair?.folderId ?? '');
	const listId = String(result.formData?.pair?.listId ?? '');
	const list = args.lists.find((item) => item.id === listId);
	if (!folderId || !listId || !list) return null;
	return { folderId, listId, listTitle: list.title };
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}
