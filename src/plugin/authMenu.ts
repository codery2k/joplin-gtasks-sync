export type AuthMenuCommand = 'gtasks.authenticate' | 'gtasks.disconnect';

export function authMenuCommand(connected: boolean): AuthMenuCommand {
	return connected ? 'gtasks.disconnect' : 'gtasks.authenticate';
}

export function googleTasksMenuCommands(connected: boolean): string[] {
	return [authMenuCommand(connected), 'gtasks.pairNotebook', 'gtasks.syncNow'];
}
