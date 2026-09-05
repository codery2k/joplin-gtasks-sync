import { Logger } from '../ports';
import { settingNumber } from './settings';
import { SettingKey } from './settings';
import { SyncService } from './syncService';

export class Scheduler {
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly sync: SyncService,
		private readonly logger: Logger,
	) {}

	async start(): Promise<void> {
		this.stop();
		const minutes = await settingNumber(SettingKey.syncIntervalMinutes);
		if (minutes <= 0) {
			this.logger.info('periodic sync disabled');
			return;
		}
		const ms = minutes * 60_000;
		this.timer = setInterval(() => {
			void this.sync.syncAll().catch((error: unknown) => {
				this.logger.error('scheduled sync failed', {
					message: error instanceof Error ? error.message : String(error),
				});
			});
		}, ms);
		this.logger.info('periodic sync started', { minutes });
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}
