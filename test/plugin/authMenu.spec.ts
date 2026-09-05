import { describe, expect, it } from 'vitest';
import { authMenuCommand, googleTasksMenuCommands } from '../../src/plugin/authMenu';

describe('authMenuCommand', () => {
	it('shows Authenticate when signed out', () => {
		expect(authMenuCommand(false)).toBe('gtasks.authenticate');
	});

	it('shows Disconnect when signed in', () => {
		expect(authMenuCommand(true)).toBe('gtasks.disconnect');
	});
});

describe('googleTasksMenuCommands', () => {
	it('puts Authenticate, pair, and sync in the submenu when signed out', () => {
		expect(googleTasksMenuCommands(false)).toEqual([
			'gtasks.authenticate',
			'gtasks.pairNotebook',
			'gtasks.syncNow',
		]);
	});

	it('puts Disconnect, pair, and sync in the submenu when signed in', () => {
		expect(googleTasksMenuCommands(true)).toEqual([
			'gtasks.disconnect',
			'gtasks.pairNotebook',
			'gtasks.syncNow',
		]);
	});
});
