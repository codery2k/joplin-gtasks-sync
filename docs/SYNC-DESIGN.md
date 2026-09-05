# Sync design

## Unit of sync

One Joplin **notebook** ⟷ one Google **task list**. Each `is_todo` note ⟷ one task.

Non-todo notes are ignored. Google subtask `parent` / `position` are preserved in link state so a round-trip does not reparent, but v1 does not expose hierarchy in Joplin.

## Canonical model

Both sides map into:

```ts
type CanonicalTask = {
  title: string;
  body: string;
  due: PlainDate | null;      // 'YYYY-MM-DD' — Google's resolution
  completed: boolean;
  completedAt: number | null;
};
```

`LinkState` is the **base** for the 3-way merge. It is the last agreed canonical value plus enough metadata to ignore echoes and keep Joplin's due time-of-day.

## Algorithm

`plan(pair, localNotes, remoteTasks, links, now) -> SyncPlan` classifies every item.

| Situation | Op |
| --- | --- |
| local only, unlinked | `CreateRemote` |
| remote only, unlinked | `CreateLocal` |
| linked, both present | diff local vs base, remote vs base → `merge` → `UpdateLocal` / `UpdateRemote` / both / none / `+WriteConflictNote` |
| linked, local gone | `DeleteRemote` |
| linked, remote gone or `deleted: true` | `DeleteLocal` |

Ops are inert. An executor applies them through ports. `reconcile(plan, results)` folds results into the next `LinkState`s.

### Field-level 3-way merge

For each canonical field:

- only local changed → take local
- only remote changed → take remote
- both changed to the same value → take that value
- both changed to different values → **true clash**: the side with the later `updated` timestamp wins the field; the loser is written to a **conflict note**. Equal timestamps: remote wins.

A clash never drops a value on the floor.

### Due dates (lossy, explicit)

Google `due` is date-only. Joplin `todo_due` has a time.

- Store the original `localDueMs` on the link.
- A remote `due` counts as changed only when its **date part** differs from the base date part.
- If the remote date is unchanged, keep `localDueMs` so we do not rewrite the local time-of-day every sync.

### Deletion

Joplin soft-deletes (`deleted_time`). Google returns `deleted: true`.

The persisted link index is what distinguishes "deleted" from "never synced":

- linked + note gone + task present → `DeleteRemote`
- linked + task gone/`deleted` + note present → `DeleteLocal`
- unlinked + present on one side only → create on the other side

### Truncation

Google `title` ≤ 1024, `notes` ≤ 8192. Mapping truncates and returns a report. The planner emits a `WriteConflictNote` (kind `truncation`) so the cut is visible. We never silently shorten a body.

### Echo suppression

After a write, reconcile stores:

- `joplinUpdatedTime` = the note's `updated_time` after our write
- `googleUpdated` / `googleEtag` = the task's `updated` / `etag` after our write
- `base` = the canonical we just agreed

Next plan: if the live note/task still matches that metadata (or maps back to `base`), it is not a change.

## Invariants

The scenario suite must keep these true on every change:

1. **Idempotence** — sync with no changes on either side produces an empty plan.
2. **Convergence** — apply a plan, re-read both fakes, sync again → empty plan.
3. **No echo** — our own writes must not register as remote (or local) changes next round.
4. **No silent loss** — every discarded value appears in a conflict note.
5. **No resurrection** — a deleted item stays deleted across repeated syncs.
6. **Truncation is visible** — a >8192-char body is truncated and reported, never silently cut.

## Out of scope (v1)

Google subtask hierarchy and ordering, recurring tasks, attachments/links, mobile Joplin, syncing non-todo notes, real-time push (Tasks has no webhooks — polling only).
