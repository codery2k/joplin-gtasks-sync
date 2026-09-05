import { plan } from '../../src/core/planner';
import { reconcile } from '../../src/core/reconcile';
import { LinkState, Pairing, SyncPlan } from '../../src/core/model';
import { executePlan } from '../../src/runtime/executor';
import { Clock, GoogleSide, JoplinSide } from '../../src/ports';

export async function runSync(args: {
	pair: Pairing;
	joplin: JoplinSide;
	google: GoogleSide;
	links: LinkState[];
	clock: Clock;
	showDeleted?: boolean;
}): Promise<{ plan: SyncPlan; links: LinkState[] }> {
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
	const results = await executePlan({
		pair: args.pair,
		plan: syncPlan,
		joplin: args.joplin,
		google: args.google,
		clock: args.clock,
	});
	return { plan: syncPlan, links: reconcile(args.links, results) };
}
