import { describe, expect, it } from 'vitest';
import { FolderPairing } from '../../src/core/model';
import { PairingStore } from '../../src/plugin/applyPairing';
import { describePairThenSync, pairThenSync } from '../../src/plugin/pairThenSync';
import { SyncSummary } from '../../src/plugin/syncService';
import { FakeClock } from '../fakes/clock';
import { InMemoryJoplinSide } from '../fakes/memoryJoplin';

function memoryStore(): PairingStore {
	const data = new Map<string, FolderPairing>();
	return {
		async getPairing(folderId) {
			return data.get(folderId) ?? null;
		},
		async setPairing(folderId, pairing) {
			data.set(folderId, pairing);
		},
	};
}

describe('pairThenSync', () => {
	it('syncs immediately after the pairing is written', async () => {
		const joplin = new InMemoryJoplinSide(new FakeClock(1));
		joplin.addFolder({ id: 'nb1', title: 'My Tasks' });
		const store = memoryStore();
		const order: string[] = [];
		const sync = {
			async syncAll(): Promise<SyncSummary> {
				order.push('sync');
				const pairing = await store.getPairing('nb1');
				expect(pairing?.listId).toBe('list-a');
				return { pairs: 1, ops: 3 };
			},
		};

		const result = await pairThenSync({
			request: {
				kind: 'one',
				listId: 'list-a',
				listTitle: 'Work',
				notebook: { kind: 'existing', folderId: 'nb1' },
			},
			lists: [{ id: 'list-a', title: 'Work' }],
			joplin,
			store,
			sync,
		});

		expect(order).toEqual(['sync']);
		expect(result.summary).toEqual({ pairs: 1, ops: 3 });
		expect(result.applied.pairs).toEqual([{ folderId: 'nb1', listTitle: 'Work' }]);
	});

	it('does not sync when pairing itself fails', async () => {
		const joplin = new InMemoryJoplinSide(new FakeClock(1));
		const store = memoryStore();
		let synced = false;
		const sync = {
			async syncAll(): Promise<SyncSummary> {
				synced = true;
				return { pairs: 0, ops: 0 };
			},
		};

		joplin.createFolder = async () => {
			throw new Error('could not create notebook');
		};

		await expect(
			pairThenSync({
				request: {
					kind: 'one',
					listId: 'list-a',
					listTitle: 'Work',
					notebook: { kind: 'create', title: 'Work' },
				},
				lists: [{ id: 'list-a', title: 'Work' }],
				joplin,
				store,
				sync,
			}),
		).rejects.toThrow('could not create notebook');
		expect(synced).toBe(false);
	});
});

describe('describePairThenSync', () => {
	it('includes the pair and the immediate sync result', () => {
		expect(
			describePairThenSync(
				{ pairs: [{ folderId: 'nb1', listTitle: 'Work' }] },
				{ pairs: 1, ops: 4 },
			),
		).toBe('Paired notebook with Work. Sync finished: 4 operation(s) across 1 pair(s).');
	});
});
