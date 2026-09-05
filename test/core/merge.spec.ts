import { describe, expect, it } from 'vitest';
import { merge } from '../../src/core/merge';
import { CanonicalTask } from '../../src/core/model';

const base: CanonicalTask = {
	title: 'Buy milk',
	body: '2%',
	due: '2024-01-15',
	completed: false,
	completedAt: null,
};

describe('merge', () => {
	it('takes the side that changed each field', () => {
		const result = merge({
			base,
			local: { ...base, title: 'Buy oat milk' },
			remote: { ...base, body: 'skim' },
			localUpdated: 10,
			remoteUpdated: 20,
		});
		expect(result.merged).toEqual({ ...base, title: 'Buy oat milk', body: 'skim' });
		expect(result.localWins).toEqual(['title']);
		expect(result.remoteWins).toEqual(['body']);
		expect(result.conflicts).toEqual([]);
	});

	it('keeps a field when both sides changed it to the same value', () => {
		const result = merge({
			base,
			local: { ...base, title: 'Buy oat milk' },
			remote: { ...base, title: 'Buy oat milk' },
			localUpdated: 10,
			remoteUpdated: 20,
		});
		expect(result.merged.title).toBe('Buy oat milk');
		expect(result.conflicts).toEqual([]);
	});

	it('on a same-field clash, later updated wins and the loser is recorded', () => {
		const result = merge({
			base,
			local: { ...base, title: 'Local title' },
			remote: { ...base, title: 'Remote title' },
			localUpdated: 10,
			remoteUpdated: 20,
		});
		expect(result.merged.title).toBe('Remote title');
		expect(result.conflicts).toEqual([
			{
				field: 'title',
				winner: 'remote',
				loserSide: 'local',
				loserValue: 'Local title',
				winnerValue: 'Remote title',
			},
		]);
	});

	it('on equal timestamps, remote wins the clashing field', () => {
		const result = merge({
			base,
			local: { ...base, body: 'local body' },
			remote: { ...base, body: 'remote body' },
			localUpdated: 50,
			remoteUpdated: 50,
		});
		expect(result.merged.body).toBe('remote body');
		expect(result.conflicts[0]).toMatchObject({ winner: 'remote', loserSide: 'local' });
	});

	it('lets the newer local side win a clash', () => {
		const result = merge({
			base,
			local: { ...base, due: '2024-02-01' },
			remote: { ...base, due: '2024-03-01' },
			localUpdated: 200,
			remoteUpdated: 100,
		});
		expect(result.merged.due).toBe('2024-02-01');
		expect(result.conflicts[0]).toMatchObject({
			field: 'due',
			winner: 'local',
			loserSide: 'remote',
			loserValue: '2024-03-01',
		});
	});
});
