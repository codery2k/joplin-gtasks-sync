import { describe, expect, it } from 'vitest';
import { FolderPairing } from '../../src/core/model';
import { applyPairing, PairingStore } from '../../src/plugin/applyPairing';
import { FakeClock } from '../fakes/clock';
import { InMemoryJoplinSide } from '../fakes/memoryJoplin';

const lists = [
	{ id: 'list-a', title: 'Work' },
	{ id: 'list-b', title: 'Home' },
];

function memoryStore(): PairingStore & { data: Map<string, FolderPairing> } {
	const data = new Map<string, FolderPairing>();
	return {
		data,
		async getPairing(folderId) {
			return data.get(folderId) ?? null;
		},
		async setPairing(folderId, pairing) {
			data.set(folderId, pairing);
		},
	};
}

describe('applyPairing', () => {
	it('records a pairing on an existing notebook', async () => {
		const joplin = new InMemoryJoplinSide(new FakeClock(1));
		joplin.addFolder({ id: 'nb1', title: 'My Tasks' });
		const store = memoryStore();

		const result = await applyPairing({
			request: {
				kind: 'one',
				listId: 'list-a',
				listTitle: 'Work',
				notebook: { kind: 'existing', folderId: 'nb1' },
			},
			lists,
			joplin,
			store,
		});

		expect(result.pairs).toEqual([{ folderId: 'nb1', listTitle: 'Work' }]);
		expect(await store.getPairing('nb1')).toMatchObject({ listId: 'list-a', listTitle: 'Work' });
	});

	it('creates a notebook and pairs it', async () => {
		const joplin = new InMemoryJoplinSide(new FakeClock(1));
		const store = memoryStore();

		const result = await applyPairing({
			request: {
				kind: 'one',
				listId: 'list-b',
				listTitle: 'Home',
				notebook: { kind: 'create', title: 'Home' },
			},
			lists,
			joplin,
			store,
		});

		const folders = await joplin.listFolders();
		expect(folders).toEqual([{ id: expect.any(String), title: 'Home' }]);
		expect(result.pairs[0]?.listTitle).toBe('Home');
		expect(await store.getPairing(folders[0].id)).toMatchObject({ listId: 'list-b' });
	});

	it('creates a notebook per unpaired list', async () => {
		const joplin = new InMemoryJoplinSide(new FakeClock(1));
		joplin.addFolder({ id: 'already', title: 'Work' });
		const store = memoryStore();
		await store.setPairing('already', { v: 1, listId: 'list-a', listTitle: 'Work', links: [] });

		const result = await applyPairing({
			request: { kind: 'all' },
			lists,
			joplin,
			store,
		});

		const folders = await joplin.listFolders();
		expect(folders.map((folder) => folder.title).sort()).toEqual(['Home', 'Work']);
		expect(result.pairs).toHaveLength(2);
		const home = folders.find((folder) => folder.title === 'Home');
		expect(home).toBeTruthy();
		expect(await store.getPairing(home!.id)).toMatchObject({ listId: 'list-b' });
		expect(await store.getPairing('already')).toMatchObject({ listId: 'list-a' });
	});

	it('reuses an unpaired notebook whose title matches the list', async () => {
		const joplin = new InMemoryJoplinSide(new FakeClock(1));
		joplin.addFolder({ id: 'nb-home', title: 'Home' });
		const store = memoryStore();

		await applyPairing({
			request: { kind: 'all' },
			lists: [{ id: 'list-b', title: 'Home' }],
			joplin,
			store,
		});

		expect(await joplin.listFolders()).toHaveLength(1);
		expect(await store.getPairing('nb-home')).toMatchObject({ listId: 'list-b' });
	});
});
