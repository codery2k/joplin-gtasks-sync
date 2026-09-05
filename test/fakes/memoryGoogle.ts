import { randomUUID } from 'node:crypto';
import { plainDateToGoogleDue } from '../../src/core/duedate';
import { canonicalToGoogleFields } from '../../src/core/mapping';
import { CanonicalTask, GOOGLE_NOTES_MAX, GOOGLE_TITLE_MAX, GoogleTask, GoogleTaskList } from '../../src/core/model';
import { Clock, GoogleSide, ListTasksOpts, TaskListNotFoundError } from '../../src/ports';

export class InMemoryGoogleTasks implements GoogleSide {
	lists = new Map<string, GoogleTaskList>();
	tasks = new Map<string, Map<string, GoogleTask>>();
	private seq = 0;

	constructor(private readonly clock: Clock) {}

	addList(list: GoogleTaskList): void {
		this.lists.set(list.id, list);
		if (!this.tasks.has(list.id)) this.tasks.set(list.id, new Map());
	}

	addTask(listId: string, task: GoogleTask): GoogleTask {
		const normalised = this.normalise(task, this.clock.now());
		this.listMap(listId).set(normalised.id, normalised);
		return { ...normalised };
	}

	async listTaskLists(): Promise<GoogleTaskList[]> {
		return [...this.lists.values()];
	}

	async listTasks(listId: string, opts: ListTasksOpts = {}): Promise<GoogleTask[]> {
		if (!this.lists.has(listId)) throw new TaskListNotFoundError(listId);
		const showCompleted = opts.showCompleted ?? false;
		const showDeleted = opts.showDeleted ?? false;
		const showHidden = opts.showHidden ?? false;
		const updatedMin = opts.updatedMin ? Date.parse(opts.updatedMin) : null;

		return [...this.listMap(listId).values()]
			.filter((task) => {
				if (task.deleted && !showDeleted) return false;
				if (task.status === 'completed' && !showCompleted && !showHidden) return false;
				if (task.hidden && !showHidden) return false;
				if (updatedMin !== null && Date.parse(task.updated) < updatedMin) return false;
				return true;
			})
			.map((task) => ({ ...task }));
	}

	async createTask(listId: string, task: CanonicalTask): Promise<GoogleTask> {
		const now = this.clock.now();
		const fields = canonicalToGoogleFields(task);
		const created: GoogleTask = this.normalise(
			{
				id: randomUUID().replaceAll('-', ''),
				title: fields.title,
				notes: fields.notes,
				status: fields.status,
				due: fields.due ?? undefined,
				completed: fields.completed ?? undefined,
				updated: new Date(now).toISOString(),
				etag: this.nextEtag(),
			},
			now,
		);
		this.listMap(listId).set(created.id, created);
		return { ...created };
	}

	async updateTask(
		listId: string,
		taskId: string,
		task: CanonicalTask,
		etag?: string,
	): Promise<GoogleTask> {
		const existing = this.listMap(listId).get(taskId);
		if (!existing || existing.deleted) {
			throw new Error(`task not found: ${taskId}`);
		}
		if (etag && existing.etag && etag !== existing.etag) {
			throw new Error(`etag mismatch for ${taskId}`);
		}
		const now = this.clock.now();
		const fields = canonicalToGoogleFields(task);
		const updated = this.normalise(
			{
				...existing,
				title: fields.title,
				notes: fields.notes,
				status: fields.status,
				due: fields.due ?? undefined,
				completed: fields.completed ?? undefined,
				deleted: false,
				updated: new Date(now).toISOString(),
				etag: this.nextEtag(),
			},
			now,
		);
		if (fields.due === null) delete updated.due;
		this.listMap(listId).set(taskId, updated);
		return { ...updated };
	}

	async deleteTask(listId: string, taskId: string): Promise<void> {
		const existing = this.listMap(listId).get(taskId);
		if (!existing) return;
		const now = this.clock.now();
		this.listMap(listId).set(taskId, {
			...existing,
			deleted: true,
			updated: new Date(now).toISOString(),
			etag: this.nextEtag(),
		});
	}

	private listMap(listId: string): Map<string, GoogleTask> {
		let map = this.tasks.get(listId);
		if (!map) {
			map = new Map();
			this.tasks.set(listId, map);
		}
		return map;
	}

	private nextEtag(): string {
		this.seq += 1;
		return `"etag-${this.seq}"`;
	}

	private normalise(task: GoogleTask, now: number): GoogleTask {
		const title = (task.title ?? '').slice(0, GOOGLE_TITLE_MAX);
		const notes = (task.notes ?? '').slice(0, GOOGLE_NOTES_MAX);
		let due = task.due;
		if (due) {
			due = plainDateToGoogleDue(due.slice(0, 10));
		}
		const completed = task.status === 'completed';
		return {
			...task,
			title,
			notes,
			due,
			status: completed ? 'completed' : 'needsAction',
			completed: completed
				? toWholeSecond(task.completed ?? new Date(now).toISOString())
				: undefined,
			hidden: completed || task.hidden,
			updated: task.updated,
			// Every mutation gets a fresh etag, the way the real API behaves.
			etag: this.nextEtag(),
		};
	}
}

// Google stores `completed` at whole-second precision; keep the fake honest.
function toWholeSecond(iso: string): string {
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) return iso;
	return new Date(Math.floor(ms / 1000) * 1000).toISOString();
}
