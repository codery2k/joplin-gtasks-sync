import joplin from 'api';
import { SettingItemType } from 'api/types';

export const SETTING_SECTION = 'gtasksSync';

export const SettingKey = {
	clientId: 'gtasksClientId',
	clientSecret: 'gtasksClientSecret',
	tokens: 'gtasksTokens',
	syncIntervalMinutes: 'gtasksSyncIntervalMinutes',
	lastError: 'gtasksLastError',
	lastSyncAt: 'gtasksLastSyncAt',
	googleUpdatedMin: 'gtasksGoogleUpdatedMin',
	status: 'gtasksStatus',
} as const;

export async function registerSettings(): Promise<void> {
	await joplin.settings.registerSection(SETTING_SECTION, {
		label: 'Google Tasks Sync',
		iconName: 'fas fa-sync',
		description: 'Two-way sync between a Joplin notebook and a Google Tasks list.',
	});

	await joplin.settings.registerSettings({
		[SettingKey.clientId]: {
			value: '',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: true,
			label: 'OAuth client ID',
			description: 'Leave empty to use a bundled client ID, if this build has one.',
		},
		[SettingKey.clientSecret]: {
			value: '',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: true,
			secure: true,
			label: 'OAuth client secret',
		},
		[SettingKey.tokens]: {
			value: '',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: false,
			secure: true,
			label: 'OAuth tokens',
		},
		[SettingKey.syncIntervalMinutes]: {
			value: 15,
			type: SettingItemType.Int,
			section: SETTING_SECTION,
			public: true,
			label: 'Sync interval (minutes)',
			description: '0 disables periodic sync. Use Sync now to run immediately.',
			minimum: 0,
			maximum: 24 * 60,
		},
		[SettingKey.lastError]: {
			value: '',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: true,
			label: 'Last error',
		},
		[SettingKey.lastSyncAt]: {
			value: '',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: true,
			label: 'Last successful sync',
		},
		[SettingKey.googleUpdatedMin]: {
			value: '',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: false,
			label: 'Google updatedMin cursor',
		},
		[SettingKey.status]: {
			value: 'Not connected',
			type: SettingItemType.String,
			section: SETTING_SECTION,
			public: true,
			label: 'Status',
		},
	});
}

export async function settingString(key: string): Promise<string> {
	const value = await joplin.settings.value(key);
	return typeof value === 'string' ? value : String(value ?? '');
}

export async function settingNumber(key: string): Promise<number> {
	const value = await joplin.settings.value(key);
	return typeof value === 'number' ? value : Number(value ?? 0);
}
