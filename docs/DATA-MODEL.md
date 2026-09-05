# Data model

## Canonical task

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | `string` | Task title |
| `body` | `string` | Notes / note body |
| `due` | `PlainDate \| null` | `YYYY-MM-DD` or none. Google's resolution, not Joplin's |
| `completed` | `boolean` | Open vs done |
| `completedAt` | `number \| null` | Completion instant, ms epoch |

## Field mapping

| Canonical | Joplin | Google Tasks | Lossy? |
| --- | --- | --- | --- |
| `title` | `note.title` | `task.title` (≤1024) | Yes — truncate + report |
| `body` | `note.body` | `task.notes` (≤8192) | Yes — truncate + report |
| `due` | `todo_due` (ms, has time) | `due` (RFC 3339, **date only**) | Yes — see below |
| `completed` | `todo_completed > 0` | `status === 'completed'` | No |
| `completedAt` | `todo_completed` (ms, `0`/null if open) | `completed` (RFC 3339) | Precision only |

Joplin-only fields we do not map: tags, attachments, notebook (beyond the pairing), `is_todo` (always 1 for synced notes).

Google-only fields we do not map in v1: `parent` / `position` (output-only; `parent` is stored on the link so we do not reparent), recurrence, hidden-but-not-deleted.

## Due-date rule

1. When pushing Joplin → Google, send the date part of `todo_due`. Keep the full `todo_due` as `LinkState.localDueMs`.
2. When reading Google → canonical, take the calendar date of `due` and ignore the time (Google discards it anyway).
3. Diff: remote `due` changed iff its date ≠ base date. Time-of-day drift on Google is not a change.
4. When applying a **new** remote date locally, write `todo_due` as noon UTC of that date (stable, no tz walk). When the remote date is unchanged, restore `localDueMs`.

## Link state (note userData `gtasks`)

```ts
type LinkState = {
  v: 1;
  listId: string;
  taskId: string;
  base: CanonicalTask;
  localDueMs: number | null;
  joplinUpdatedTime: number;
  googleUpdated: string;
  googleEtag?: string;
  googleParent?: string;
};
```

`v` is for future migrations. `joplinUpdatedTime` / `googleUpdated` / `googleEtag` exist to suppress echoes. `googleParent` is preserved across round-trips; v1 does not create or edit hierarchy.

## Pairing (folder userData `gtasks-list`)

```ts
type FolderPairing = {
  v: 1;
  listId: string;
  listTitle?: string;
};
```

One notebook, one list. Pairings sync across devices with the folder.

## Device-local settings

| Key | Storage | Purpose |
| --- | --- | --- |
| OAuth client id / secret | settings (secret may be bundled) | Same auth flow, two credential sources |
| Refresh / access tokens | settings, `secure: true` | Keychain if available |
| Google poll `updatedMin` | settings | Incremental `tasks.list` |
| Joplin event cursor | settings | Incremental `/events?cursor=` |
| Sync interval, last error | settings | Scheduler + UI |

## Conflict notes

Created in the paired notebook. They are **not** `is_todo` and are **not** synced to Google.

They record the losing field values (true clash) or a truncation report. Title prefix: `[gtasks conflict]`.
