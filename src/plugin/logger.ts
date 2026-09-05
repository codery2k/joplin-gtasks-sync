import { Logger } from '../ports';

export class ConsoleLogger implements Logger {
	info(message: string, meta?: Record<string, unknown>): void {
		console.info(`[gtasks] ${message}`, meta ?? '');
	}

	warn(message: string, meta?: Record<string, unknown>): void {
		console.warn(`[gtasks] ${message}`, meta ?? '');
	}

	error(message: string, meta?: Record<string, unknown>): void {
		console.error(`[gtasks] ${message}`, meta ?? '');
	}
}
