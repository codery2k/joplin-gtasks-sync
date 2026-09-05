import { CONFLICT_TITLE_PREFIX, Conflict, TruncationReport } from './model';

export function conflictNoteTitle(sourceTitle: string): string {
	return `${CONFLICT_TITLE_PREFIX} ${sourceTitle}`.trim();
}

export function formatConflictBody(args: {
	sourceTitle: string;
	conflicts: Conflict[];
}): string {
	const lines = [
		`# Conflict: ${args.sourceTitle}`,
		'',
		'A same-field clash was resolved by timestamp. The losing values are kept here so nothing is silently dropped.',
		'',
		'| Field | Winner | Winner value | Loser | Loser value |',
		'| --- | --- | --- | --- | --- |',
	];
	for (const conflict of args.conflicts) {
		lines.push(
			`| ${conflict.field} | ${conflict.winner} | ${stringify(conflict.winnerValue)} | ${conflict.loserSide} | ${stringify(conflict.loserValue)} |`,
		);
	}
	return `${lines.join('\n')}\n`;
}

export function formatTruncationBody(args: {
	sourceTitle: string;
	truncations: TruncationReport[];
}): string {
	const lines = [
		`# Truncation: ${args.sourceTitle}`,
		'',
		'Google Tasks limits were applied. The cut is recorded here so it is not silent.',
		'',
	];
	for (const truncation of args.truncations) {
		lines.push(
			`- \`${truncation.field}\`: ${truncation.originalLength} → ${truncation.truncatedLength} characters`,
		);
		if (truncation.discarded) {
			lines.push('');
			lines.push('Discarded text:');
			lines.push('');
			lines.push('```');
			lines.push(truncation.discarded);
			lines.push('```');
		}
	}
	return `${lines.join('\n')}\n`;
}

function stringify(value: unknown): string {
	if (value === null || value === undefined) return '∅';
	if (typeof value === 'string') return value.replace(/\|/g, '\\|');
	return String(value);
}
