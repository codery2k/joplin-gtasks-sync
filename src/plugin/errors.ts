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
