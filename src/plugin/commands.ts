import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import { GoogleAuthClient } from '../google/authClient';
import { GoogleSide, JoplinSide, Logger } from '../ports';
import { pickPairing } from './dialogs/pairing';
import { LinkStore } from './linkStore';
import { SettingKey } from './settings';
import { SyncService } from './syncService';

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
		label: 'Google Tasks: Authenticate',
		iconName: 'fas fa-user-lock',
		execute: async () => {
			const tokens = await args.auth.authenticate();
			const status = tokens.email ? `Connected as ${tokens.email}` : 'Connected';
			await joplin.settings.setValue(SettingKey.status, status);
			await joplin.views.dialogs.showMessageBox(status);
		},
	});

	await joplin.commands.register({
		name: 'gtasks.disconnect',
		label: 'Google Tasks: Disconnect',
		execute: async () => {
			await args.auth.disconnect();
			await joplin.settings.setValue(SettingKey.status, 'Not connected');
		},
	});

	await joplin.commands.register({
		name: 'gtasks.pairNotebook',
		label: 'Google Tasks: Pair notebook…',
		execute: async () => {
			const folders = await args.joplinSide.listFolders();
			const lists = await args.googleSide.listTaskLists();
			const picked = await pickPairing({ folders, lists });
			if (!picked) return;
			await args.links.setPairing(picked.folderId, {
				v: 1,
				listId: picked.listId,
				listTitle: picked.listTitle,
				links: (await args.links.getPairing(picked.folderId))?.links ?? [],
			});
			await joplin.views.dialogs.showMessageBox(`Paired notebook with ${picked.listTitle}`);
		},
	});

	await joplin.commands.register({
		name: 'gtasks.syncNow',
		label: 'Google Tasks: Sync now',
		iconName: 'fas fa-sync',
		execute: async () => {
			const summary = await args.sync.syncAll();
			args.logger.info('manual sync', summary);
			await joplin.views.dialogs.showMessageBox(
				`Sync finished: ${summary.ops} operation(s) across ${summary.pairs} pair(s).`,
			);
		},
	});

	await joplin.views.menuItems.create('gtasksAuthenticateMenu', 'gtasks.authenticate', MenuItemLocation.Tools);
	await joplin.views.menuItems.create('gtasksPairMenu', 'gtasks.pairNotebook', MenuItemLocation.Tools);
	await joplin.views.menuItems.create('gtasksSyncNowMenu', 'gtasks.syncNow', MenuItemLocation.Tools);
}
