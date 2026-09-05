import { describe, expect, it } from 'vitest';
import { HttpError, requestWithBackoff } from '../../src/google/http';

describe('http backoff', () => {
	it('retries 429 and 5xx then returns the successful body', async () => {
		const statuses = [429, 503, 200];
		const sleeps: number[] = [];
		const fetchFn: typeof fetch = async () => {
			const status = statuses.shift() ?? 200;
			return new Response(status === 200 ? '{"ok":true}' : 'nope', {
				status,
				headers: status === 429 ? { 'retry-after': '1' } : undefined,
			});
		};

		const response = await requestWithBackoff(
			{ url: 'https://tasks.googleapis.com/tasks/v1/lists' },
			{
				fetch: fetchFn,
				sleep: async (ms) => {
					sleeps.push(ms);
				},
			},
		);

		expect(response.status).toBe(200);
		expect(response.text).toBe('{"ok":true}');
		expect(sleeps[0]).toBe(1000);
		expect(sleeps[1]).toBe(500);
	});

	it('does not retry a 401', async () => {
		await expect(
			requestWithBackoff(
				{ url: 'https://example.test/x' },
				{
					fetch: async () => new Response('denied', { status: 401 }),
					sleep: async () => {
						throw new Error('should not sleep');
					},
				},
			),
		).rejects.toBeInstanceOf(HttpError);
	});
});
