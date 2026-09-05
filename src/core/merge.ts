import { diff, fieldValuesEqual } from './diff';
import { CanonicalField, CanonicalTask, CANONICAL_FIELDS, Conflict, MergeResult } from './model';

export function merge(args: {
	base: CanonicalTask;
	local: CanonicalTask;
	remote: CanonicalTask;
	localUpdated: number;
	remoteUpdated: number;
}): MergeResult {
	const { base, local, remote, localUpdated, remoteUpdated } = args;
	const localChanges = diff(base, local);
	const remoteChanges = diff(base, remote);
	const merged: CanonicalTask = { ...base };
	const localWins: CanonicalField[] = [];
	const remoteWins: CanonicalField[] = [];
	const conflicts: Conflict[] = [];

	for (const field of CANONICAL_FIELDS) {
		const localChange = localChanges[field];
		const remoteChange = remoteChanges[field];
		if (!localChange && !remoteChange) continue;

		if (localChange && !remoteChange) {
			merged[field] = local[field] as never;
			localWins.push(field);
			continue;
		}

		if (remoteChange && !localChange) {
			merged[field] = remote[field] as never;
			remoteWins.push(field);
			continue;
		}

		if (fieldValuesEqual(field, local[field], remote[field])) {
			merged[field] = local[field] as never;
			continue;
		}

		const remoteWinsClash = remoteUpdated >= localUpdated;
		const winner: 'local' | 'remote' = remoteWinsClash ? 'remote' : 'local';
		merged[field] = (winner === 'remote' ? remote[field] : local[field]) as never;
		if (winner === 'remote') remoteWins.push(field);
		else localWins.push(field);
		conflicts.push({
			field,
			winner,
			loserSide: winner === 'remote' ? 'local' : 'remote',
			loserValue: winner === 'remote' ? local[field] : remote[field],
			winnerValue: merged[field],
		});
	}

	return { merged, localWins, remoteWins, conflicts };
}
