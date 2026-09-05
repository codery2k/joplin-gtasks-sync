import { CanonicalTask, GoogleTask, GoogleTaskList, JoplinNote } from './core/model';

export type ListTasksOpts = {
	updatedMin?: string;
	showDeleted?: boolean;
	showHidden?: boolean;
	showCompleted?: boolean;
};

export type FolderInfo = {
	id: string;
	title: string;
};

export interface JoplinSide {
	listFolders(): Promise<FolderInfo[]>;
	listTodos(folderId: string): Promise<JoplinNote[]>;
	getNote(id: string): Promise<JoplinNote | null>;
	createTodo(folderId: string, task: CanonicalTask, dueMs: number | null): Promise<JoplinNote>;
	updateTodo(id: string, task: CanonicalTask, dueMs: number | null): Promise<JoplinNote>;
	deleteNote(id: string): Promise<void>;
	createConflictNote(folderId: string, title: string, body: string): Promise<JoplinNote>;
}

export interface GoogleSide {
	listTaskLists(): Promise<GoogleTaskList[]>;
	listTasks(listId: string, opts?: ListTasksOpts): Promise<GoogleTask[]>;
	createTask(listId: string, task: CanonicalTask): Promise<GoogleTask>;
	updateTask(listId: string, taskId: string, task: CanonicalTask, etag?: string): Promise<GoogleTask>;
	deleteTask(listId: string, taskId: string): Promise<void>;
}

export interface Clock {
	now(): number;
}

export interface Logger {
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
}
