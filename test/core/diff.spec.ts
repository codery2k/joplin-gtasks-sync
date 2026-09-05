import { describe, expect, it } from 'vitest';
import { diff, hasChanges } from '../../src/core/diff';
import { CanonicalTask } from '../../src/core/model';

const base: CanonicalTask = {
	title: 'Buy milk',
	body: '2%',
	due: '2024-01-15',
	completed: false,
	completedAt: null,
};

describe('diff', () => {
	it('returns no changes when values match', () => {
		expect(diff(base, { ...base })).toEqual({});
		expect(hasChanges(diff(base, { ...base }))).toBe(false);
	});

	it('reports each changed canonical field', () => {
		expect(
			diff(base, {
				...base,
				title: 'Buy oat milk',
				due: '2024-01-16',
				completed: true,
				completedAt: 1,
			}),
		).toEqual({
			title: { from: 'Buy milk', to: 'Buy oat milk' },
			due: { from: '2024-01-15', to: '2024-01-16' },
			completed: { from: false, to: true },
			completedAt: { from: null, to: 1 },
		});
	});

	it('treats due as a date-only field (already normalised)', () => {
		expect(diff(base, { ...base, due: '2024-01-15' })).toEqual({});
		expect(diff(base, { ...base, due: null })).toEqual({
			due: { from: '2024-01-15', to: null },
		});
	});
});
