import joplin from 'api';
import { GoogleTaskList } from '../../core/model';
import { FolderInfo } from '../../ports';
import { pairingFormHtml, parsePairingForm, PairingRequest } from './pairingForm';

export async function pickPairing(args: {
	folders: FolderInfo[];
	lists: GoogleTaskList[];
}): Promise<PairingRequest | null> {
	const handle = await joplin.views.dialogs.create(`gtasksPairingDialog-${Date.now()}`);
	await joplin.views.dialogs.setFitToContent(handle, true);
	await joplin.views.dialogs.setHtml(handle, pairingFormHtml(args));
	await joplin.views.dialogs.setButtons(handle, [
		{ id: 'ok', title: 'Pair' },
		{ id: 'cancel', title: 'Cancel' },
	]);

	const result = await joplin.views.dialogs.open(handle);
	if (result.id !== 'ok') return null;
	const form = (result.formData?.pair ?? {}) as Record<string, unknown>;
	return parsePairingForm(form, args);
}
