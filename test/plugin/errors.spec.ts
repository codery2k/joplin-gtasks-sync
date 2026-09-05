import { describe, expect, it } from 'vitest';
import { describeRemovedPairing, describeSyncSummary, explainPairingError } from '../../src/plugin/errors';

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

describe('describeRemovedPairing', () => {
	it('tells the user the list is gone, the pairing was removed, and the notebook stays', () => {
		const message = describeRemovedPairing({
			folderTitle: 'My Tasks',
			listTitle: 'Work',
		});
		expect(message).toMatch(/Work/);
		expect(message).toMatch(/My Tasks/);
		expect(message).toMatch(/deleted/i);
		expect(message).toMatch(/pairing/i);
		expect(message).toMatch(/kept/i);
	});
});

describe('describeSyncSummary', () => {
	it('leads with the removed-pairing notice and does not look like a crash', () => {
		const message = describeSyncSummary({
			pairs: 0,
			ops: 0,
			removedPairings: [{ folderTitle: 'My Tasks', listTitle: 'Work' }],
		});
		expect(message).toMatch(/Work/);
		expect(message).not.toMatch(/HTTP 404/);
		expect(message).not.toMatch(/^Error:/);
	});
});
