import { CanonicalTask } from './model';

export type ApplyResult =
	| {
			kind: 'createdRemote';
			listId: string;
			noteId: string;
			taskId: string;
			base: CanonicalTask;
			localDueMs: number | null;
			joplinUpdatedTime: number;
			googleUpdated: string;
			googleEtag?: string;
			googleParent?: string;
	  }
	| {
			kind: 'createdLocal';
			listId: string;
			noteId: string;
			taskId: string;
			base: CanonicalTask;
			localDueMs: number | null;
			joplinUpdatedTime: number;
			googleUpdated: string;
			googleEtag?: string;
			googleParent?: string;
	  }
	| {
			kind: 'updatedLocal';
			listId: string;
			noteId: string;
			taskId: string;
			base: CanonicalTask;
			localDueMs: number | null;
			joplinUpdatedTime: number;
			googleUpdated: string;
			googleEtag?: string;
			googleParent?: string;
	  }
	| {
			kind: 'updatedRemote';
			listId: string;
			noteId: string;
			taskId: string;
			base: CanonicalTask;
			localDueMs: number | null;
			googleUpdated: string;
			googleEtag?: string;
			googleParent?: string;
	  }
	| { kind: 'deletedLocal'; noteId: string; taskId: string }
	| { kind: 'deletedRemote'; noteId: string; taskId: string }
	| { kind: 'wroteConflictNote'; noteId: string };
