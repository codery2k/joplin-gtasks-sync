import { canonicalToGoogleFields, taskToCanonical } from '../core/mapping';
import { CanonicalTask, GoogleTask, GoogleTaskList } from '../core/model';
import { GoogleSide, ListTasksOpts, TaskListNotFoundError } from '../ports';
import { GoogleAuthClient } from './authClient';
import { FetchLike, HttpError, requestJson } from './http';

const API = 'https://tasks.googleapis.com/tasks/v1';

type TasksPage = {
	items?: GoogleTask[];
	nextPageToken?: string;
};

type TaskListsPage = {
	items?: Array<{ id: string; title: string }>;
	nextPageToken?: string;
};

export class GoogleTasksClient implements GoogleSide {
	constructor(
		private readonly auth: GoogleAuthClient,
		private readonly fetchFn: FetchLike = fetch,
	) {}

	async listTaskLists(): Promise<GoogleTaskList[]> {
		const lists: GoogleTaskList[] = [];
		let pageToken: string | undefined;
		do {
			const url = new URL(`${API}/users/@me/lists`);
			url.searchParams.set('maxResults', '100');
			if (pageToken) url.searchParams.set('pageToken', pageToken);
			const page = await this.authed<TaskListsPage>(url.toString());
			for (const item of page.items ?? []) {
				lists.push({ id: item.id, title: item.title });
			}
			pageToken = page.nextPageToken;
		} while (pageToken);
		return lists;
	}

	async listTasks(listId: string, opts: ListTasksOpts = {}): Promise<GoogleTask[]> {
		const tasks: GoogleTask[] = [];
		let pageToken: string | undefined;
		try {
			do {
				const url = new URL(`${API}/lists/${encodeURIComponent(listId)}/tasks`);
				url.searchParams.set('maxResults', '100');
				url.searchParams.set('showCompleted', String(opts.showCompleted ?? true));
				url.searchParams.set('showDeleted', String(opts.showDeleted ?? true));
				url.searchParams.set('showHidden', String(opts.showHidden ?? true));
				if (opts.updatedMin) url.searchParams.set('updatedMin', opts.updatedMin);
				if (pageToken) url.searchParams.set('pageToken', pageToken);
				const page = await this.authed<TasksPage>(url.toString());
				tasks.push(...(page.items ?? []));
				pageToken = page.nextPageToken;
			} while (pageToken);
		} catch (error) {
			if (error instanceof HttpError && error.status === 404) {
				throw new TaskListNotFoundError(listId);
			}
			throw error;
		}
		return tasks;
	}

	async createTask(listId: string, task: CanonicalTask): Promise<GoogleTask> {
		const fields = canonicalToGoogleFields(task);
		return this.authed<GoogleTask>(`${API}/lists/${encodeURIComponent(listId)}/tasks`, {
			method: 'POST',
			body: JSON.stringify(toApiTask(fields)),
		});
	}

	async updateTask(
		listId: string,
		taskId: string,
		task: CanonicalTask,
		etag?: string,
	): Promise<GoogleTask> {
		const fields = canonicalToGoogleFields(task);
		const headers: Record<string, string> = {};
		if (etag) headers['If-Match'] = etag;
		return this.authed<GoogleTask>(
			`${API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
			{
				method: 'PATCH',
				headers,
				body: JSON.stringify(toApiTask(fields)),
			},
		);
	}

	async deleteTask(listId: string, taskId: string): Promise<void> {
		await this.authed<unknown>(
			`${API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
			{ method: 'DELETE' },
		);
	}

	private async authed<T>(url: string, init: RequestInit = {}): Promise<T> {
		const token = await this.auth.getAccessToken();
		return requestJson<T>(
			{
				url,
				method: init.method,
				headers: {
					authorization: `Bearer ${token}`,
					'content-type': 'application/json',
					...(init.headers as Record<string, string> | undefined),
				},
				body: typeof init.body === 'string' ? init.body : undefined,
			},
			{ fetch: this.fetchFn },
		);
	}
}

export { taskToCanonical };

function toApiTask(fields: ReturnType<typeof canonicalToGoogleFields>): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		title: fields.title,
		notes: fields.notes,
		status: fields.status,
	};
	if (fields.due) payload.due = fields.due;
	else payload.due = null;
	if (fields.completed) payload.completed = fields.completed;
	return payload;
}
