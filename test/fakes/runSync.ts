import { plan } from '../../src/core/planner';
import { reconcile } from '../../src/core/reconcile';
import { LinkState, Pairing, SyncPlan } from '../../src/core/model';
import { ExecuteOutcome, executePlan } from '../../src/runtime/executor';
import { Clock, GoogleSide, JoplinSide } from '../../src/ports';

export async function runSync(args: {
	pair: Pairing;
	joplin: JoplinSide;
	google: GoogleSide;
	links: LinkState[];
	clock: Clock;
	showDeleted?: boolean;
	/** Return a mid-plan failure instead of throwing, so a test can inspect it. */
	tolerateFailure?: boolean;
}): Promise<{ plan: SyncPlan; links: LinkState[]; failure?: ExecuteOutcome['failure'] }> {
	const localNotes = await args.joplin.listTodos(args.pair.folderId);
	const remoteTasks = await args.google.listTasks(args.pair.listId, {
		showCompleted: true,
		showDeleted: args.showDeleted ?? true,
		showHidden: true,
	});
	const syncPlan = plan({
		pair: args.pair,
		localNotes,
		remoteTasks,
		links: args.links,
		now: args.clock.now(),
	});
	const outcome = await executePlan({
		pair: args.pair,
		plan: syncPlan,
		joplin: args.joplin,
		google: args.google,
		clock: args.clock,
	});
	// Mirror syncService: reconcile what landed, then surface the failure.
	const links = reconcile(args.links, outcome.results);
	if (outcome.failure && !args.tolerateFailure) throw outcome.failure.error;
	return { plan: syncPlan, links, failure: outcome.failure };
}
