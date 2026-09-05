export type PlainDate = string;

export const CANONICAL_FIELDS = ['title', 'body', 'due', 'completed', 'completedAt'] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export type CanonicalTask = {
	title: string;
	body: string;
	due: PlainDate | null;
	completed: boolean;
	completedAt: number | null;
};

export type JoplinNote = {
	id: string;
	title: string;
	body: string;
	parentId: string;
	isTodo: boolean;
	todoDue: number | null;
	todoCompleted: number | null;
	updatedTime: number;
	deletedTime: number | null;
};

export type GoogleTask = {
	id: string;
	title?: string;
	notes?: string;
	status?: 'needsAction' | 'completed';
	due?: string;
	completed?: string;
	deleted?: boolean;
	hidden?: boolean;
	parent?: string;
	position?: string;
	updated: string;
	etag?: string;
};

export type GoogleTaskList = {
	id: string;
	title: string;
};

export type LinkState = {
	v: 1;
	listId: string;
	taskId: string;
	noteId: string;
	base: CanonicalTask;
	localDueMs: number | null;
	joplinUpdatedTime: number;
	googleUpdated: string;
	googleEtag?: string;
	googleParent?: string;
};

export type FolderPairing = {
	v: 1;
	listId: string;
	listTitle?: string;
	links: Array<{ noteId: string; taskId: string }>;
};

export type Pairing = {
	folderId: string;
	listId: string;
};

export type FieldChange = { from: unknown; to: unknown };
export type FieldChanges = Partial<Record<CanonicalField, FieldChange>>;

export type Conflict = {
	field: CanonicalField;
	winner: 'local' | 'remote';
	loserSide: 'local' | 'remote';
	loserValue: unknown;
	winnerValue: unknown;
};

export type TruncationReport = {
	field: 'title' | 'body';
	originalLength: number;
	truncatedLength: number;
	discarded: string;
};

export type MergeResult = {
	merged: CanonicalTask;
	localWins: CanonicalField[];
	remoteWins: CanonicalField[];
	conflicts: Conflict[];
};

export type CreateRemoteOp = {
	type: 'CreateRemote';
	noteId: string;
	task: CanonicalTask;
	localDueMs: number | null;
	truncations: TruncationReport[];
	applyLocalTruncation: boolean;
};

export type CreateLocalOp = {
	type: 'CreateLocal';
	taskId: string;
	task: CanonicalTask;
	googleUpdated: string;
	googleEtag?: string;
	googleParent?: string;
};

export type UpdateLocalOp = {
	type: 'UpdateLocal';
	noteId: string;
	taskId: string;
	task: CanonicalTask;
	fields: CanonicalField[];
	localDueMs: number | null;
};

export type UpdateRemoteOp = {
	type: 'UpdateRemote';
	noteId: string;
	taskId: string;
	task: CanonicalTask;
	fields: CanonicalField[];
	etag?: string;
	truncations: TruncationReport[];
};

export type DeleteLocalOp = {
	type: 'DeleteLocal';
	noteId: string;
	taskId: string;
};

export type DeleteRemoteOp = {
	type: 'DeleteRemote';
	noteId: string;
	taskId: string;
};

export type WriteConflictNoteOp = {
	type: 'WriteConflictNote';
	noteId?: string;
	taskId?: string;
	kind: 'conflict' | 'truncation';
	conflicts?: Conflict[];
	truncations?: TruncationReport[];
	title: string;
	body: string;
};

export type Op =
	| CreateRemoteOp
	| CreateLocalOp
	| UpdateLocalOp
	| UpdateRemoteOp
	| DeleteLocalOp
	| DeleteRemoteOp
	| WriteConflictNoteOp;

export type SyncPlan = {
	ops: Op[];
};

export const GOOGLE_TITLE_MAX = 1024;
export const GOOGLE_NOTES_MAX = 8192;
export const USERDATA_LINK_KEY = 'gtasks';
export const USERDATA_PAIR_KEY = 'gtasks-list';
export const CONFLICT_TITLE_PREFIX = '[gtasks conflict]';
