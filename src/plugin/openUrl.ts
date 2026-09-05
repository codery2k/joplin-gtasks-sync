import { createRequire } from 'module';

const nodeRequire = createRequire(__filename);

export async function openExternalUrl(url: string): Promise<void> {
	try {
		// Joplin desktop plugins run in Electron and can open the system browser.
		const electron = nodeRequire('electron') as { shell?: { openExternal: (target: string) => Promise<void> } };
		if (electron.shell?.openExternal) {
			await electron.shell.openExternal(url);
			return;
		}
	} catch {
		// fall through
	}
	throw new Error(`Could not open the system browser for ${url}`);
}
