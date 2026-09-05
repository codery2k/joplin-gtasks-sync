import joplin from 'api';
import { OAuthTokens, TokenStore } from '../google/authClient';
import { SettingKey } from './settings';

export class SettingsTokenStore implements TokenStore {
	async load(): Promise<OAuthTokens | null> {
		const raw = (await joplin.settings.value(SettingKey.tokens)) as string;
		if (!raw) return null;
		try {
			return JSON.parse(raw) as OAuthTokens;
		} catch {
			return null;
		}
	}

	async save(tokens: OAuthTokens): Promise<void> {
		await joplin.settings.setValue(SettingKey.tokens, JSON.stringify(tokens));
	}

	async clear(): Promise<void> {
		await joplin.settings.setValue(SettingKey.tokens, '');
	}
}
