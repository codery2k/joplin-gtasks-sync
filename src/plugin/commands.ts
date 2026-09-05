import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import { GoogleAuthClient } from '../google/authClient';
import { GoogleSide, JoplinSide, Logger } from '../ports';
import { describeError } from '../google/http';
import { googleTasksMenuCommands } from './authMenu';
import { pickPairing } from './dialogs/pairing';
import { explainPairingError } from './errors';
import { LinkStore } from './linkStore';
import { SettingKey } from './settings';
import { SyncService } from './syncService';

const TASKS_MENU_ID = 'gtasksMenu';

async function showGoogleTasksMenu(connected: boolean): Promise<void> {
	const menuItems = googleTasksMenuCommands(connected).map((commandName) => ({ commandName }));
	try {
		await joplin.views.menus.create(TASKS_MENU_ID, 'Google Tasks', menuItems, MenuItemLocation.Tools);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (!message.includes('View already added')) throw error;
	}
}

export async function registerCommands(args: {
	auth: GoogleAuthClient;
	sync: SyncService;
	joplinSide: JoplinSide;
	googleSide: GoogleSide;
	links: LinkStore;
	logger: Logger;
}): Promise<void> {
	await joplin.commands.register({
		name: 'gtasks.authenticate',
		label: 'Authenticate',
		iconName: 'fas fa-user-lock',
		execute: async () => {
			try {
				const tokens = await args.auth.authenticate();
				const status = tokens.email ? `Connected as ${tokens.email}` : 'Connected';
				await joplin.settings.setValue(SettingKey.status, status);
				await showGoogleTasksMenu(true);
				await joplin.views.dialogs.showMessageBox(status);
			} catch (error) {
				const message = describeError(error);
				await joplin.settings.setValue(SettingKey.status, `Error: ${message}`);
				await joplin.views.dialogs.showMessageBox(message);
			}
		},
	});

	await joplin.commands.register({
		name: 'gtasks.disconnect',
		label: 'Disconnect',
		execute: async () => {
			try {
				await args.auth.disconnect();
				await joplin.settings.setValue(SettingKey.status, 'Not connected');
				await showGoogleTasksMenu(false);
				await joplin.views.dialogs.showMessageBox('Disconnected from Google Tasks.');
			} catch (error) {
				await joplin.views.dialogs.showMessageBox(describeError(error));
			}
		},
	});

	await joplin.commands.register({
		name: 'gtasks.pairNotebook',
		label: 'Pair notebook…',
		execute: async () => {
			try {
				const folders = await args.joplinSide.listFolders();
				if (!folders.length) {
					await joplin.views.dialogs.showMessageBox(
						'This profile has no notebooks. Create one, then pair again.',
					);
					return;
				}
				const lists = await args.googleSide.listTaskLists();
				if (!lists.length) {
					await joplin.views.dialogs.showMessageBox(
						'No Google task lists found. Create a list in Google Tasks, then pair again.',
					);
					return;
				}
				const picked = await pickPairing({ folders, lists });
				if (!picked) return;
				await args.links.setPairing(picked.folderId, {
					v: 1,
					listId: picked.listId,
					listTitle: picked.listTitle,
					links: (await args.links.getPairing(picked.folderId))?.links ?? [],
				});
				await joplin.views.dialogs.showMessageBox(`Paired notebook with ${picked.listTitle}`);
			} catch (error) {
				const message = describeError(error);
				args.logger.error('pair failed', { message });
				await joplin.settings.setValue(SettingKey.status, `Error: ${message}`);
				await joplin.views.dialogs.showMessageBox(explainPairingError(message));
			}
		},
	});

	await joplin.commands.register({
		name: 'gtasks.syncNow',
		label: 'Sync now',
		iconName: 'fas fa-sync',
		execute: async () => {
			try {
				const summary = await args.sync.syncAll();
				args.logger.info('manual sync', summary);
				const detail =
					summary.pairs === 0
						? 'Nothing to sync — pair a notebook first (Tools → Google Tasks → Pair notebook…).'
						: `Sync finished: ${summary.ops} operation(s) across ${summary.pairs} pair(s).`;
				await joplin.views.dialogs.showMessageBox(detail);
			} catch (error) {
				const message = describeError(error);
				await joplin.views.dialogs.showMessageBox(message);
			}
		},
	});

	await showGoogleTasksMenu(await args.auth.isConnected());
}
