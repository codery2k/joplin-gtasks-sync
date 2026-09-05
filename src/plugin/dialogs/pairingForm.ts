import { GoogleTaskList } from '../../core/model';
import { FolderInfo } from '../../ports';

export type PairingRequest =
	| {
			kind: 'one';
			listId: string;
			listTitle: string;
			notebook: { kind: 'existing'; folderId: string } | { kind: 'create'; title: string };
	  }
	| { kind: 'all' };

const PAIRING_FORM_CSS = `
html { color-scheme: var(--joplin-appearance, dark); }
#joplin-plugin-content {
	box-sizing: border-box;
	width: 460px;
	padding: 8px 4px 4px;
	overflow: visible;
}
.pairing-shell { width: 460px; }
.pairing-form {
	color: var(--joplin-color, #dddddd);
	font-family: var(--joplin-font-family, sans-serif);
	width: 100%;
	overflow-wrap: anywhere;
}
.pairing-form p.lead { margin: 0 0 16px; }
.pairing-form .field {
	display: block;
	margin: 0 0 14px;
	font-weight: 600;
}
.pairing-form select {
	display: block;
	box-sizing: border-box;
	width: 100%;
	margin-top: 6px;
	padding: 4px 8px;
	color: var(--joplin-color, #dddddd);
	background-color: var(--joplin-background-color, #1D2024);
	border: 1px solid var(--joplin-divider-color, #555555);
	border-radius: 3px;
}
.pairing-form .check-row {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	margin: 12px 0 4px;
	font-weight: 600;
}
.pairing-form .check-row input { margin-top: 2px; flex: 0 0 auto; }
.pairing-form input[type="checkbox"] {
	accent-color: var(--joplin-color4, #789FE9);
}
.pairing-form .hint {
	margin: 0 0 12px 24px;
	font-size: 12px;
	font-style: italic;
	color: var(--joplin-color-faded, #999999);
	font-weight: 400;
}
.pairing-form:has([name="createAll"]:checked) .single { display: none; }
.pairing-form:has([name="createNew"]:checked) .existing { display: none; }
`;

export function pairingFormHtml(args: { folders: FolderInfo[]; lists: GoogleTaskList[] }): string {
	const listOptions = args.lists
		.map((list) => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.title)}</option>`)
		.join('');
	const folderOptions = args.folders
		.map((folder) => `<option value="${escapeHtml(folder.id)}">${escapeHtml(folder.title)}</option>`)
		.join('');
	const noFolders = args.folders.length === 0;

	return `<style>${PAIRING_FORM_CSS}</style>
		<div class="pairing-shell">
		<form name="pair" class="pairing-form">
			<p class="lead">Pair a Joplin notebook with a Google Tasks list.</p>
			<div class="single">
				<label class="field">Google Tasks list
					<select name="listId">${listOptions}</select>
				</label>
				${noFolders ? '<input type="hidden" name="createNew" value="1">' : ''}
				<label class="check-row">
					<input type="checkbox" name="createNew" value="1"${noFolders ? ' checked disabled' : ''}>
					Create a new notebook
				</label>
				<p class="hint">Uses the Google Tasks list name.</p>
				${
					noFolders
						? ''
						: `<label class="field existing">Notebook
					<select name="folderId">${folderOptions}</select>
				</label>`
				}
			</div>
			<label class="check-row">
				<input type="checkbox" name="createAll" value="1">
				Create new notebooks for all Google Tasks lists
			</label>
			<p class="hint">One notebook per list, named after the list. Existing pairings are left as-is.</p>
		</form>
		</div>`;
}

export function parsePairingForm(
	form: Record<string, unknown>,
	args: { folders: FolderInfo[]; lists: GoogleTaskList[] },
): PairingRequest | null {
	if (isChecked(form.createAll)) return { kind: 'all' };

	const listId = String(form.listId ?? '');
	const list = args.lists.find((item) => item.id === listId);
	if (!list) return null;

	if (isChecked(form.createNew)) {
		return {
			kind: 'one',
			listId: list.id,
			listTitle: list.title,
			notebook: { kind: 'create', title: list.title },
		};
	}

	const folderId = String(form.folderId ?? '');
	if (!folderId || !args.folders.some((folder) => folder.id === folderId)) return null;
	return {
		kind: 'one',
		listId: list.id,
		listTitle: list.title,
		notebook: { kind: 'existing', folderId },
	};
}

function isChecked(value: unknown): boolean {
	return value === true || value === '1' || value === 'on' || value === 'true';
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}
