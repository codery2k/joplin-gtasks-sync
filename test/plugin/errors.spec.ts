import { describe, expect, it } from 'vitest';
import { explainPairingError } from '../../src/plugin/errors';

describe('explainPairingError', () => {
	it('tells the user to authenticate when no token is stored', () => {
		expect(explainPairingError('Not authenticated with Google Tasks')).toContain('Authenticate first');
	});

	it('tells the user to re-consent when the token lacks the Tasks scope', () => {
		const message = explainPairingError(
			'HTTP 403 GET https://tasks.googleapis.com/tasks/v1/users/@me/lists — Request had insufficient authentication scopes.',
		);
		expect(message).toMatch(/test user/i);
		expect(message).toMatch(/Disconnect/i);
	});
});
