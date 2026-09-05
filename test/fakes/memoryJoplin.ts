import { randomUUID } from 'node:crypto';
import { canonicalToNoteFields } from '../../src/core/mapping';
import { CanonicalTask, JoplinNote } from '../../src/core/model';
import { Clock, FolderInfo, JoplinSide } from '../../src/ports';

export class InMemoryJoplinSide implements JoplinSide {
	folders = new Map<string, FolderInfo>();
	notes = new Map<string, JoplinNote>();
	userData = new Map<string, Record<string, unknown>>();

	constructor(private readonly clock: Clock) {}

	addFolder(folder: FolderInfo): void {
		this.folders.set(folder.id, folder);
	}

	addNote(note: JoplinNote): JoplinNote {
		this.notes.set(note.id, { ...note });
		return this.notes.get(note.id)!;
	}

	async listFolders(): Promise<FolderInfo[]> {
		return [...this.folders.values()];
	}

	async createFolder(title: string): Promise<FolderInfo> {
		const folder: FolderInfo = { id: randomUUID().replaceAll('-', ''), title };
		this.folders.set(folder.id, folder);
		return { ...folder };
	}

	async listTodos(folderId: string): Promise<JoplinNote[]> {
		return [...this.notes.values()].filter(
			(note) => note.parentId === folderId && note.isTodo && !note.deletedTime,
		);
	}

	async getNote(id: string): Promise<JoplinNote | null> {
		const note = this.notes.get(id);
		if (!note || note.deletedTime) return null;
		return { ...note };
	}

	async createTodo(folderId: string, task: CanonicalTask, dueMs: number | null): Promise<JoplinNote> {
		const now = this.clock.now();
		const fields = canonicalToNoteFields(task, dueMs, now);
		const note: JoplinNote = {
			id: randomUUID().replaceAll('-', ''),
			parentId: folderId,
			updatedTime: now,
			deletedTime: null,
			...fields,
		};
		this.notes.set(note.id, note);
		return { ...note };
	}

	async updateTodo(id: string, task: CanonicalTask, dueMs: number | null): Promise<JoplinNote> {
		const existing = this.notes.get(id);
		if (!existing || existing.deletedTime) {
			throw new Error(`note not found: ${id}`);
		}
		const now = this.clock.now();
		const fields = canonicalToNoteFields(task, dueMs, now);
		const note: JoplinNote = {
			...existing,
			...fields,
			updatedTime: now,
		};
		this.notes.set(id, note);
		return { ...note };
	}

	async deleteNote(id: string): Promise<void> {
		const existing = this.notes.get(id);
		if (!existing) return;
		this.notes.set(id, { ...existing, deletedTime: this.clock.now(), updatedTime: this.clock.now() });
	}

	async createConflictNote(folderId: string, title: string, body: string): Promise<JoplinNote> {
		const now = this.clock.now();
		const note: JoplinNote = {
			id: randomUUID().replaceAll('-', ''),
			title,
			body,
			parentId: folderId,
			isTodo: false,
			todoDue: null,
			todoCompleted: null,
			updatedTime: now,
			deletedTime: null,
		};
		this.notes.set(note.id, note);
		return { ...note };
	}
}
