export function explainPairingError(message: string): string {
	if (message === 'Not authenticated with Google Tasks') {
		return 'Not signed in. Use Tools → Google Tasks → Authenticate first.';
	}
	if (/insufficient authentication scopes/i.test(message)) {
		return [
			'Google signed you in but did not grant the Tasks permission.',
			'In Google Cloud → Google Auth Platform → Audience, add your Google account as a test user.',
			'Then Tools → Google Tasks → Disconnect, Authenticate again, and accept access to your tasks.',
		].join(' ');
	}
	return message;
}

export function describeRemovedPairing(removed: { folderTitle: string; listTitle?: string }): string {
	const list = removed.listTitle ? `"${removed.listTitle}"` : 'the paired Google Tasks list';
	return `Google Tasks list ${list} was deleted, so the sync pairing was removed from notebook "${removed.folderTitle}". The notebook and its notes were kept.`;
}

export function describeSyncSummary(summary: {
	pairs: number;
	ops: number;
	removedPairings: Array<{ folderTitle: string; listTitle?: string }>;
}): string {
	const notices = summary.removedPairings.map(describeRemovedPairing);
	if (summary.pairs === 0 && summary.removedPairings.length === 0) {
		return 'Nothing to sync — pair a notebook first (Tools → Google Tasks → Pair notebook…).';
	}
	const finished =
		summary.pairs > 0 ? `Sync finished: ${summary.ops} operation(s) across ${summary.pairs} pair(s).` : '';
	return [...notices, finished].filter(Boolean).join('\n\n');
}
