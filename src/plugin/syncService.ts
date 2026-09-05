import { plan } from '../core/planner';
import { reconcile } from '../core/reconcile';
import { Pairing } from '../core/model';
import { Clock, GoogleSide, JoplinSide, Logger, TaskListNotFoundError } from '../ports';
import { executePlan } from '../runtime/executor';
import { describeRemovedPairing } from './errors';
import { LinkStore } from './linkStore';
import { SettingKey } from './settings';

export type RemovedPairing = {
	folderId: string;
	folderTitle: string;
	listId: string;
	listTitle?: string;
};

export type SyncSummary = {
	pairs: number;
	ops: number;
	removedPairings: RemovedPairing[];
};

export type SyncSettings = {
	setValue(key: string, value: unknown): Promise<void>;
};

export class SyncService {
	private running = false;

	constructor(
		private readonly joplinSide: JoplinSide,
		private readonly googleSide: GoogleSide,
		private readonly links: LinkStore,
		private readonly clock: Clock,
		private readonly logger: Logger,
		private readonly settings: SyncSettings,
	) {}

	async syncAll(): Promise<SyncSummary> {
		if (this.running) {
			this.logger.warn('sync skipped because another run is in flight');
			return { pairs: 0, ops: 0, removedPairings: [] };
		}
		this.running = true;
		try {
			const folders = await this.joplinSide.listFolders();
			let ops = 0;
			let pairs = 0;
			const removedPairings: RemovedPairing[] = [];
			for (const folder of folders) {
				const pairing = await this.links.getPairing(folder.id);
				if (!pairing) continue;
				try {
					ops += await this.syncPair({ folderId: folder.id, listId: pairing.listId });
					pairs += 1;
				} catch (error) {
					if (!(error instanceof TaskListNotFoundError)) throw error;
					await this.links.clearPairing(folder.id);
					removedPairings.push({
						folderId: folder.id,
						folderTitle: folder.title,
						listId: pairing.listId,
						listTitle: pairing.listTitle,
					});
					this.logger.warn('remote task list gone; pairing removed', {
						folderId: folder.id,
						listId: pairing.listId,
					});
				}
			}
			const notices = removedPairings.map(describeRemovedPairing);
			const syncLine = `Last sync: ${ops} operation(s) across ${pairs} pair(s)`;
			const status = notices.length ? `${syncLine}. ${notices.join(' ')}` : syncLine;
			await this.settings.setValue(SettingKey.lastError, '');
			await this.settings.setValue(SettingKey.lastSyncAt, new Date(this.clock.now()).toISOString());
			await this.settings.setValue(SettingKey.status, status);
			this.logger.info('sync finished', { pairs, ops, removed: removedPairings.length });
			return { pairs, ops, removedPairings };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.settings.setValue(SettingKey.lastError, message);
			await this.settings.setValue(SettingKey.status, `Error: ${message}`);
			this.logger.error('sync failed', { message });
			throw error;
		} finally {
			this.running = false;
		}
	}

	private async syncPair(pair: Pairing): Promise<number> {
		const localNotes = await this.joplinSide.listTodos(pair.folderId);
		const remoteTasks = await this.googleSide.listTasks(pair.listId, {
			showCompleted: true,
			showDeleted: true,
			showHidden: true,
		});
		const existing = await this.links.loadLinks(pair.folderId, pair.listId);
		const syncPlan = plan({
			pair,
			localNotes,
			remoteTasks,
			links: existing,
			now: this.clock.now(),
		});
		const outcome = await executePlan({
			pair,
			plan: syncPlan,
			joplin: this.joplinSide,
			google: this.googleSide,
			clock: this.clock,
		});
		// Persist what did land before surfacing the failure: an applied op with
		// no stored link would be re-applied as a duplicate on the next run.
		const next = reconcile(existing, outcome.results);
		await this.links.saveLinks(pair.folderId, pair.listId, next);
		if (outcome.failure) {
			this.logger.error('sync stopped part-way through a plan', {
				op: outcome.failure.op.type,
				applied: outcome.results.length,
				planned: syncPlan.ops.length,
			});
			throw outcome.failure.error;
		}
		return syncPlan.ops.length;
	}
}
