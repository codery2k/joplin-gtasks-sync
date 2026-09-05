import joplin from 'api';
import { GoogleAuthClient } from './google/authClient';
import { GoogleTasksClient } from './google/tasksClient';
import { BUNDLED_CLIENT_ID, BUNDLED_CLIENT_SECRET } from './plugin/bundledOauth';
import { registerCommands } from './plugin/commands';
import { JoplinRepo } from './plugin/joplinRepo';
import { LinkStore } from './plugin/linkStore';
import { ConsoleLogger } from './plugin/logger';
import { openExternalUrl } from './plugin/openUrl';
import { Scheduler } from './plugin/scheduler';
import { registerSettings, SettingKey, settingString } from './plugin/settings';
import { SyncService } from './plugin/syncService';
import { SettingsTokenStore } from './plugin/tokenStore';

joplin.plugins.register({
	onStart: async function () {
		await registerSettings();

		const logger = new ConsoleLogger();
		const joplinSide = new JoplinRepo();
		const links = new LinkStore();
		const tokenStore = new SettingsTokenStore();
		const clock = { now: () => Date.now() };

		const clientId = (await settingString(SettingKey.clientId)) || BUNDLED_CLIENT_ID;
		const clientSecret = (await settingString(SettingKey.clientSecret)) || BUNDLED_CLIENT_SECRET;
		const auth = new GoogleAuthClient(
			{ clientId, clientSecret: clientSecret || undefined },
			tokenStore,
			{ openUrl: openExternalUrl },
		);
		const googleSide = new GoogleTasksClient(auth);
		const sync = new SyncService(joplinSide, googleSide, links, clock, logger);
		const scheduler = new Scheduler(sync, logger);

		await registerCommands({ auth, sync, joplinSide, googleSide, links, logger });
		await refreshStatus(auth);
		await scheduler.start();

		await joplin.settings.onChange(async (event) => {
			if (event.keys.includes(SettingKey.syncIntervalMinutes)) {
				await scheduler.start();
			}
		});

		logger.info('Google Tasks Sync plugin started');
	},
});

async function refreshStatus(auth: GoogleAuthClient): Promise<void> {
	const email = await auth.connectedEmail();
	if (email) {
		await joplin.settings.setValue(SettingKey.status, `Connected as ${email}`);
	}
}
