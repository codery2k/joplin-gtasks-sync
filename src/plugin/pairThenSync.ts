import { GoogleTaskList } from '../core/model';
import { JoplinSide } from '../ports';
import { AppliedPair, applyPairing, PairingStore } from './applyPairing';
import { PairingRequest } from './dialogs/pairingForm';
import { describeSyncSummary } from './errors';
import { SyncSummary } from './syncService';

export async function pairThenSync(args: {
	request: PairingRequest;
	lists: GoogleTaskList[];
	joplin: JoplinSide;
	store: PairingStore;
	sync: { syncAll(): Promise<SyncSummary> };
}): Promise<{ applied: { pairs: AppliedPair[] }; summary: SyncSummary }> {
	const applied = await applyPairing({
		request: args.request,
		lists: args.lists,
		joplin: args.joplin,
		store: args.store,
	});
	const summary = await args.sync.syncAll();
	return { applied, summary };
}

export function describePairThenSync(
	applied: { pairs: AppliedPair[] },
	summary: SyncSummary,
): string {
	const paired =
		applied.pairs.length === 1
			? `Paired notebook with ${applied.pairs[0].listTitle}.`
			: `Paired ${applied.pairs.length} notebook(s).`;
	const sync = describeSyncSummary(summary);
	return sync.startsWith('Sync finished:') ? `${paired} ${sync}` : `${paired}\n\n${sync}`;
}
