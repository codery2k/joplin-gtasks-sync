const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isPlainDate(value: string): boolean {
	const match = PLAIN_DATE.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const dt = new Date(Date.UTC(year, month - 1, day));
	return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

export function msToPlainDate(ms: number): string {
	const dt = new Date(ms);
	const year = dt.getUTCFullYear();
	const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
	const day = String(dt.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function plainDateToNoonUtcMs(date: string): number {
	if (!isPlainDate(date)) {
		throw new Error(`invalid plain date: ${date}`);
	}
	const [year, month, day] = date.split('-').map(Number);
	return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
}

export function googleDueToPlainDate(due: string): string {
	const date = due.slice(0, 10);
	if (!isPlainDate(date)) {
		throw new Error(`invalid Google due: ${due}`);
	}
	return date;
}

export function plainDateToGoogleDue(date: string): string {
	if (!isPlainDate(date)) {
		throw new Error(`invalid plain date: ${date}`);
	}
	return `${date}T00:00:00.000Z`;
}

export function resolveLocalDueMs(opts: {
	mergedDue: string | null;
	baseDue: string | null;
	localDueMs: number | null;
}): number | null {
	if (opts.mergedDue === null) return null;
	if (
		opts.mergedDue === opts.baseDue &&
		opts.localDueMs !== null &&
		msToPlainDate(opts.localDueMs) === opts.mergedDue
	) {
		return opts.localDueMs;
	}
	return plainDateToNoonUtcMs(opts.mergedDue);
}
