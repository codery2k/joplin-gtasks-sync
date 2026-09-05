import { plan } from '../core/planner';
import { reconcile } from '../core/reconcile';
import { Pairing } from '../core/model';
import { Clock, GoogleSide, JoplinSide, Logger } from '../ports';
import { executePlan } from '../runtime/executor';
import { LinkStore } from './linkStore';
import { SettingKey } from './settings';
import joplin from 'api';

export type SyncSummary = {
	pairs: number;
	ops: number;
};

export class SyncService {
	private running = false;

	constructor(
		private readonly joplinSide: JoplinSide,
		private readonly googleSide: GoogleSide,
		private readonly links: LinkStore,
		private readonly clock: Clock,
		private readonly logger: Logger,
	) {}

	async syncAll(): Promise<SyncSummary> {
		if (this.running) {
			this.logger.warn('sync skipped because another run is in flight');
			return { pairs: 0, ops: 0 };
		}
		this.running = true;
		try {
			const folders = await this.joplinSide.listFolders();
			let ops = 0;
			let pairs = 0;
			for (const folder of folders) {
				const pairing = await this.links.getPairing(folder.id);
				if (!pairing) continue;
				pairs += 1;
				ops += await this.syncPair({ folderId: folder.id, listId: pairing.listId });
				void pairing;
			}
			await joplin.settings.setValue(SettingKey.lastError, '');
			await joplin.settings.setValue(SettingKey.lastSyncAt, new Date(this.clock.now()).toISOString());
			await joplin.settings.setValue(SettingKey.status, `Last sync: ${ops} operation(s) across ${pairs} pair(s)`);
			this.logger.info('sync finished', { pairs, ops });
			return { pairs, ops };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await joplin.settings.setValue(SettingKey.lastError, message);
			await joplin.settings.setValue(SettingKey.status, `Error: ${message}`);
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
