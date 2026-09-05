import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GoogleAuthClient, TokenStore, OAuthTokens } from '../../src/google/authClient';
import { GoogleTasksClient } from '../../src/google/tasksClient';
import { TaskListNotFoundError } from '../../src/ports';

const tokens: OAuthTokens = {
	accessToken: 'access',
	refreshToken: 'refresh',
	expiresAt: Date.now() + 60 * 60_000,
};

const store: TokenStore = {
	async load() {
		return tokens;
	},
	async save() {},
	async clear() {},
};

const auth = new GoogleAuthClient({ clientId: 'id', clientSecret: 'secret' }, store, {
	openUrl: async () => {},
});

const server = setupServer();

describe('GoogleTasksClient', () => {
	beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
	afterEach(() => server.resetHandlers());
	afterAll(() => server.close());

	it('paginates task lists and tasks, including updatedMin', async () => {
		server.use(
			http.get('https://tasks.googleapis.com/tasks/v1/users/@me/lists', ({ request }) => {
				const url = new URL(request.url);
				if (!url.searchParams.get('pageToken')) {
					return HttpResponse.json({
						items: [{ id: 'l1', title: 'One' }],
						nextPageToken: 'p2',
					});
				}
				return HttpResponse.json({ items: [{ id: 'l2', title: 'Two' }] });
			}),
			http.get('https://tasks.googleapis.com/tasks/v1/lists/l1/tasks', ({ request }) => {
				const url = new URL(request.url);
				expect(url.searchParams.get('updatedMin')).toBe('2024-01-01T00:00:00.000Z');
				expect(url.searchParams.get('showDeleted')).toBe('true');
				if (!url.searchParams.get('pageToken')) {
					return HttpResponse.json({
						items: [{ id: 't1', title: 'A', status: 'needsAction', updated: '2024-01-02T00:00:00.000Z' }],
						nextPageToken: 'n2',
					});
				}
				return HttpResponse.json({
					items: [{ id: 't2', title: 'B', status: 'completed', updated: '2024-01-03T00:00:00.000Z' }],
				});
			}),
		);

		const client = new GoogleTasksClient(auth);
		await expect(client.listTaskLists()).resolves.toEqual([
			{ id: 'l1', title: 'One' },
			{ id: 'l2', title: 'Two' },
		]);
		const tasks = await client.listTasks('l1', { updatedMin: '2024-01-01T00:00:00.000Z' });
		expect(tasks.map((task) => task.id)).toEqual(['t1', 't2']);
	});

	it('creates, patches, and deletes tasks', async () => {
		const calls: string[] = [];
		server.use(
			http.post('https://tasks.googleapis.com/tasks/v1/lists/l1/tasks', async ({ request }) => {
				calls.push('create');
				const body = (await request.json()) as { title: string };
				expect(body.title).toBe('New');
				return HttpResponse.json({
					id: 't9',
					title: 'New',
					status: 'needsAction',
					updated: '2024-02-01T00:00:00.000Z',
					etag: '"e9"',
				});
			}),
			http.patch('https://tasks.googleapis.com/tasks/v1/lists/l1/tasks/t9', async ({ request }) => {
				calls.push('patch');
				expect(request.headers.get('If-Match')).toBe('"e9"');
				return HttpResponse.json({
					id: 't9',
					title: 'Newer',
					status: 'needsAction',
					updated: '2024-02-02T00:00:00.000Z',
					etag: '"e10"',
				});
			}),
			http.delete('https://tasks.googleapis.com/tasks/v1/lists/l1/tasks/t9', () => {
				calls.push('delete');
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const client = new GoogleTasksClient(auth);
		const created = await client.createTask('l1', {
			title: 'New',
			body: '',
			due: null,
			completed: false,
			completedAt: null,
		});
		expect(created.id).toBe('t9');
		await client.updateTask(
			'l1',
			't9',
			{ title: 'Newer', body: '', due: null, completed: false, completedAt: null },
			'"e9"',
		);
		await client.deleteTask('l1', 't9');
		expect(calls).toEqual(['create', 'patch', 'delete']);
	});

	it('turns a 404 on list tasks into TaskListNotFoundError', async () => {
		server.use(
			http.get('https://tasks.googleapis.com/tasks/v1/lists/WWt3bk1fb09kcmFnMXY3Sw/tasks', () =>
				HttpResponse.json({ error: { message: 'Task list not found.' } }, { status: 404 }),
			),
		);

		const client = new GoogleTasksClient(auth);
		await expect(client.listTasks('WWt3bk1fb09kcmFnMXY3Sw')).rejects.toBeInstanceOf(TaskListNotFoundError);
	});
});
