import { describe, expect, it } from 'vitest';
import {
	googleDueToPlainDate,
	isPlainDate,
	msToPlainDate,
	plainDateToGoogleDue,
	plainDateToNoonUtcMs,
	resolveLocalDueMs,
} from '../../src/core/duedate';

describe('duedate', () => {
	it('accepts valid YYYY-MM-DD values', () => {
		expect(isPlainDate('2024-02-29')).toBe(true);
		expect(isPlainDate('2024-13-01')).toBe(false);
		expect(isPlainDate('2024-02-30')).toBe(false);
		expect(isPlainDate('24-02-01')).toBe(false);
	});

	it('uses the UTC date part of a Joplin ms timestamp', () => {
		expect(msToPlainDate(Date.UTC(2024, 0, 15, 22, 30, 0))).toBe('2024-01-15');
	});

	it('normalises Google due to a date and midnight UTC on the way back', () => {
		expect(googleDueToPlainDate('2024-01-15T23:59:59.000Z')).toBe('2024-01-15');
		expect(plainDateToGoogleDue('2024-01-15')).toBe('2024-01-15T00:00:00.000Z');
	});

	it('keeps localDueMs when the remote date part is unchanged', () => {
		const localDueMs = Date.UTC(2024, 0, 15, 17, 45, 0);
		expect(
			resolveLocalDueMs({
				mergedDue: '2024-01-15',
				baseDue: '2024-01-15',
				localDueMs,
			}),
		).toBe(localDueMs);
	});

	it('uses noon UTC when the due date is new or localDueMs is missing', () => {
		expect(
			resolveLocalDueMs({
				mergedDue: '2024-01-16',
				baseDue: '2024-01-15',
				localDueMs: Date.UTC(2024, 0, 15, 17, 45, 0),
			}),
		).toBe(plainDateToNoonUtcMs('2024-01-16'));

		expect(
			resolveLocalDueMs({
				mergedDue: '2024-01-15',
				baseDue: '2024-01-15',
				localDueMs: null,
			}),
		).toBe(plainDateToNoonUtcMs('2024-01-15'));
	});

	it('clears due when merged due is null', () => {
		expect(
			resolveLocalDueMs({
				mergedDue: null,
				baseDue: '2024-01-15',
				localDueMs: Date.UTC(2024, 0, 15, 17, 0, 0),
			}),
		).toBeNull();
	});
});
