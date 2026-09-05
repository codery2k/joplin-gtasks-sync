import { describe, expect, it } from 'vitest';
import { pairingFormHtml, parsePairingForm } from '../../src/plugin/dialogs/pairingForm';

const folders = [{ id: 'nb1', title: 'My Tasks' }];
const lists = [
	{ id: 'list-recurring', title: 'recurring' },
	{ id: 'list-inbox', title: 'Inbox' },
];

describe('pairingFormHtml', () => {
	const html = pairingFormHtml({ folders, lists });

	it('labels the remote picker Google Tasks list and puts it first', () => {
		expect(html).toMatch(/Google Tasks list/);
		expect(html).not.toMatch(/>Task list</);
		const listPos = html.indexOf('name="listId"');
		const folderPos = html.indexOf('name="folderId"');
		expect(listPos).toBeGreaterThan(-1);
		expect(folderPos).toBeGreaterThan(listPos);
	});

	it('offers a create-new-notebook toggle and a create-all option', () => {
		expect(html).toMatch(/name="createNew"/);
		expect(html).toMatch(/Create a new notebook/);
		expect(html).toMatch(/name="createAll"/);
		expect(html).toMatch(/all Google Tasks lists/);
	});

	it('styles dropdowns with Joplin theme colors instead of native light controls', () => {
		expect(html).toMatch(/color-scheme:\s*var\(--joplin-appearance/);
		expect(html).toMatch(/select\s*\{[^}]*--joplin-background-color/);
		expect(html).not.toMatch(/appearance:\s*none/);
	});

	it('gives the dialog a fixed width so Joplin does not clip labels', () => {
		expect(html).toMatch(/#joplin-plugin-content\s*\{[^}]*width:\s*460px/);
		expect(html).toMatch(/overflow-wrap:\s*anywhere/);
	});
});

describe('parsePairingForm', () => {
	it('pairs an existing notebook with the chosen list', () => {
		expect(
			parsePairingForm({ listId: 'list-recurring', folderId: 'nb1' }, { folders, lists }),
		).toEqual({
			kind: 'one',
			listId: 'list-recurring',
			listTitle: 'recurring',
			notebook: { kind: 'existing', folderId: 'nb1' },
		});
	});

	it('creates a notebook named after the chosen list when the toggle is on', () => {
		expect(
			parsePairingForm({ listId: 'list-inbox', createNew: '1' }, { folders, lists }),
		).toEqual({
			kind: 'one',
			listId: 'list-inbox',
			listTitle: 'Inbox',
			notebook: { kind: 'create', title: 'Inbox' },
		});
	});

	it('creates notebooks for every list when that option is checked', () => {
		expect(parsePairingForm({ createAll: 'on' }, { folders, lists })).toEqual({ kind: 'all' });
	});

	it('allows creating a notebook when the profile has none yet', () => {
		expect(
			parsePairingForm({ listId: 'list-inbox', createNew: '1' }, { folders: [], lists }),
		).toEqual({
			kind: 'one',
			listId: 'list-inbox',
			listTitle: 'Inbox',
			notebook: { kind: 'create', title: 'Inbox' },
		});
	});

	it('returns null when an existing notebook is required but missing', () => {
		expect(parsePairingForm({ listId: 'list-inbox' }, { folders: [], lists })).toBeNull();
		expect(parsePairingForm({ folderId: 'nb1' }, { folders, lists })).toBeNull();
	});
});
