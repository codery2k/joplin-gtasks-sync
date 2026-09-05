import { describe, expect, it, vi } from 'vitest';
import { FolderPairing } from '../../src/core/model';
import { LinkStore } from '../../src/plugin/linkStore';
import { SettingKey } from '../../src/plugin/settings';
import { SyncService } from '../../src/plugin/syncService';

vi.mock('api', () => ({
	default: {
		settings: { setValue: async () => {} },
		data: {
			userDataGet: async () => null,
			userDataSet: async () => {},
			userDataDelete: async () => {},
		},
	},
}));
import { FakeClock } from '../fakes/clock';
import { InMemoryGoogleTasks } from '../fakes/memoryGoogle';
import { InMemoryJoplinSide } from '../fakes/memoryJoplin';

function memoryLinks(): Pick<LinkStore, 'getPairing' | 'setPairing' | 'clearPairing' | 'loadLinks' | 'saveLinks'> & {
	data: Map<string, FolderPairing>;
} {
	const data = new Map<string, FolderPairing>();
	return {
		data,
		async getPairing(folderId) {
			return data.get(folderId) ?? null;
		},
		async setPairing(folderId, pairing) {
			data.set(folderId, pairing);
		},
		async clearPairing(folderId) {
			data.delete(folderId);
		},
		async loadLinks() {
			return [];
		},
		async saveLinks() {},
	};
}

function silentLogger() {
	return { info() {}, warn() {}, error() {} };
}

function memorySettings() {
	const values = new Map<string, unknown>();
	return {
		values,
		async setValue(key: string, value: unknown) {
			values.set(key, value);
		},
	};
}

describe('SyncService — deleted Google list', () => {
	it('removes the pairing, keeps the notebook, and does not throw', async () => {
		const clock = new FakeClock(1);
		const joplin = new InMemoryJoplinSide(clock);
		joplin.addFolder({ id: 'nb1', title: 'My Tasks' });
		joplin.addNote({
			id: 'n1',
			title: 'Buy milk',
			body: '',
			parentId: 'nb1',
			isTodo: true,
			todoDue: null,
			todoCompleted: null,
			updatedTime: 1,
			deletedTime: null,
		});
		const google = new InMemoryGoogleTasks(clock);
		const links = memoryLinks();
		await links.setPairing('nb1', { v: 1, listId: 'gone', listTitle: 'Work', links: [] });
		const settings = memorySettings();

		const sync = new SyncService(joplin, google, links as LinkStore, clock, silentLogger(), settings);
		const summary = await sync.syncAll();

		expect(summary.pairs).toBe(0);
		expect(summary.ops).toBe(0);
		expect(summary.removedPairings).toEqual([
			{ folderId: 'nb1', folderTitle: 'My Tasks', listId: 'gone', listTitle: 'Work' },
		]);
		expect(await links.getPairing('nb1')).toBeNull();
		expect(await joplin.listFolders()).toEqual([{ id: 'nb1', title: 'My Tasks' }]);
		expect(joplin.notes.get('n1')?.title).toBe('Buy milk');
		expect(settings.values.get(SettingKey.lastError)).toBe('');
		expect(String(settings.values.get(SettingKey.status))).toMatch(/Work/);
		expect(String(settings.values.get(SettingKey.status))).toMatch(/My Tasks/);
	});

	it('still syncs other pairings when one list is gone', async () => {
		const clock = new FakeClock(1);
		const joplin = new InMemoryJoplinSide(clock);
		joplin.addFolder({ id: 'nb-gone', title: 'Old' });
		joplin.addFolder({ id: 'nb-ok', title: 'Current' });
		const google = new InMemoryGoogleTasks(clock);
		google.addList({ id: 'alive', title: 'Current' });
		const links = memoryLinks();
		await links.setPairing('nb-gone', { v: 1, listId: 'gone', listTitle: 'Old', links: [] });
		await links.setPairing('nb-ok', { v: 1, listId: 'alive', listTitle: 'Current', links: [] });
		const settings = memorySettings();

		const sync = new SyncService(joplin, google, links as LinkStore, clock, silentLogger(), settings);

		const summary = await sync.syncAll();
		expect(summary.removedPairings).toHaveLength(1);
		expect(summary.pairs).toBe(1);
		expect(await links.getPairing('nb-gone')).toBeNull();
		expect(await links.getPairing('nb-ok')).toMatchObject({ listId: 'alive' });
	});

	it('still fails when the error is not a missing list', async () => {
		const clock = new FakeClock(1);
		const joplin = new InMemoryJoplinSide(clock);
		joplin.addFolder({ id: 'nb1', title: 'My Tasks' });
		const google = new InMemoryGoogleTasks(clock);
		google.addList({ id: 'list-a', title: 'Work' });
		google.listTasks = async () => {
			throw new Error('network blip');
		};
		const links = memoryLinks();
		await links.setPairing('nb1', { v: 1, listId: 'list-a', listTitle: 'Work', links: [] });
		const settings = memorySettings();

		const sync = new SyncService(joplin, google, links as LinkStore, clock, silentLogger(), settings);

		await expect(sync.syncAll()).rejects.toThrow('network blip');
		expect(await links.getPairing('nb1')).toMatchObject({ listId: 'list-a' });
	});
});
