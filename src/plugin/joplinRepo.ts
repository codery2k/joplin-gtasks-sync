import joplin from 'api';
import { canonicalToNoteFields } from '../core/mapping';
import { CanonicalTask, JoplinNote } from '../core/model';
import { FolderInfo, JoplinSide } from '../ports';

type RawNote = {
	id: string;
	title?: string;
	body?: string;
	parent_id?: string;
	is_todo?: number;
	todo_due?: number;
	todo_completed?: number;
	updated_time?: number;
	deleted_time?: number;
};

export class JoplinRepo implements JoplinSide {
	async listFolders(): Promise<FolderInfo[]> {
		const folders: FolderInfo[] = [];
		let page = 1;
		let hasMore = true;
		while (hasMore) {
			const result = (await joplin.data.get(['folders'], {
				fields: ['id', 'title'],
				page,
			})) as { items?: FolderInfo[]; has_more?: boolean };
			folders.push(...(result.items ?? []));
			hasMore = !!result.has_more;
			page += 1;
		}
		return folders;
	}

	async listTodos(folderId: string): Promise<JoplinNote[]> {
		const notes: JoplinNote[] = [];
		let page = 1;
		let hasMore = true;
		while (hasMore) {
			const result = (await joplin.data.get(['folders', folderId, 'notes'], {
				fields: [
					'id',
					'title',
					'body',
					'parent_id',
					'is_todo',
					'todo_due',
					'todo_completed',
					'updated_time',
					'deleted_time',
				],
				page,
			})) as { items?: RawNote[]; has_more?: boolean };
			for (const item of result.items ?? []) {
				const mapped = mapNote(item);
				if (mapped.isTodo && !mapped.deletedTime) notes.push(mapped);
			}
			hasMore = !!result.has_more;
			page += 1;
		}
		return notes;
	}

	async getNote(id: string): Promise<JoplinNote | null> {
		try {
			const item = (await joplin.data.get(['notes', id], {
				fields: [
					'id',
					'title',
					'body',
					'parent_id',
					'is_todo',
					'todo_due',
					'todo_completed',
					'updated_time',
					'deleted_time',
				],
			})) as RawNote;
			const mapped = mapNote(item);
			return mapped.deletedTime ? null : mapped;
		} catch {
			return null;
		}
	}

	async createTodo(folderId: string, task: CanonicalTask, dueMs: number | null): Promise<JoplinNote> {
		const fields = canonicalToNoteFields(task, dueMs, Date.now());
		const created = (await joplin.data.post(['notes'], null, {
			title: fields.title,
			body: fields.body,
			parent_id: folderId,
			is_todo: 1,
			todo_due: fields.todoDue ?? 0,
			todo_completed: fields.todoCompleted ?? 0,
		})) as RawNote;
		const note = await this.getNote(created.id);
		if (!note) throw new Error('failed to read created note');
		return note;
	}

	async updateTodo(id: string, task: CanonicalTask, dueMs: number | null): Promise<JoplinNote> {
		const fields = canonicalToNoteFields(task, dueMs, Date.now());
		await joplin.data.put(['notes', id], null, {
			title: fields.title,
			body: fields.body,
			is_todo: 1,
			todo_due: fields.todoDue ?? 0,
			todo_completed: fields.todoCompleted ?? 0,
		});
		const note = await this.getNote(id);
		if (!note) throw new Error(`failed to read updated note ${id}`);
		return note;
	}

	async deleteNote(id: string): Promise<void> {
		await joplin.data.delete(['notes', id]);
	}

	async createConflictNote(folderId: string, title: string, body: string): Promise<JoplinNote> {
		const created = (await joplin.data.post(['notes'], null, {
			title,
			body,
			parent_id: folderId,
			is_todo: 0,
		})) as RawNote;
		const note = await this.getNote(created.id);
		if (!note) throw new Error('failed to read conflict note');
		return note;
	}
}

function mapNote(raw: RawNote): JoplinNote {
	return {
		id: raw.id,
		title: raw.title ?? '',
		body: raw.body ?? '',
		parentId: raw.parent_id ?? '',
		isTodo: !!raw.is_todo,
		todoDue: raw.todo_due && raw.todo_due > 0 ? raw.todo_due : null,
		todoCompleted: raw.todo_completed && raw.todo_completed > 0 ? raw.todo_completed : null,
		updatedTime: raw.updated_time ?? 0,
		deletedTime: raw.deleted_time && raw.deleted_time > 0 ? raw.deleted_time : null,
	};
}
