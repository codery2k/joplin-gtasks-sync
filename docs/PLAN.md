# Joplin ⟷ Google Tasks two-way sync plugin — plan

## Context

`/Users/saurabh/source/personal/js/joplin-gtasks-sync` is an empty directory. We are building a
Joplin desktop plugin that keeps a Joplin notebook and a Google Tasks list in two-way sync, so
to-dos created or completed on a phone (Google Tasks) show up in Joplin and vice versa.

Two-way sync is the hard part: the risk is not "can we call the APIs" but silent data loss and
sync loops. So the work is organised around a **pure, fully-tested sync core** with all I/O pushed
to the edges, built TDD-style. The first commit is tests, docs and agent files — no feature code.

### Decisions taken (from the planning Q&A)


| Decision  | Choice                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Sync unit | Joplin **notebook** ⟷ Google **task list**; each `is_todo` note ⟷ one task                           |
| Conflicts | Field-level 3-way merge; on a true same-field clash, write the losing version to a **conflict note** |
| Auth UX   | Settings → *Authenticate* → system browser → Google SSO → captured back in Joplin automatically      |
| Tooling   | `yo joplin` scaffold (webpack → `.jpl`) + **Vitest** for the test loop                               |




### Verified API facts this design relies on

- `joplin.data.userDataGet/Set/Delete(ModelType, itemId, key, value)` exists — arbitrary JSON
attached to a note or folder, **synced across devices**, merged last-write-wins per key. This is
where per-note sync state lives, so nothing pollutes note bodies.
- Joplin note to-do fields: `is_todo`, `todo_due` (ms epoch, has time-of-day), `todo_completed`
(ms epoch, 0/null when open), `updated_time`, `parent_id`, `deleted_time`.
- Joplin `/events?cursor=` returns create/update/delete events (`type` 1/2/3), retained 90 days.
- Google Task fields: `title` (≤1024), `notes` (≤8192), `status` (`needsAction`|`completed`),
`completed`, `due`, `deleted`, `hidden`, `parent`/`position` (**output-only**), `updated`, `etag`.
- `due` **discards the time portion — date only.** This is the main lossy mapping and it needs
explicit handling or every sync will churn.
- `tasks.list` supports `updatedMin`, `showCompleted`, `showDeleted`, `showHidden`; page size
default 20, max 100. There is no push/webhook for Tasks — polling only.



### Known risks, flagged up front

1. **Sensitive scope.** `.../auth/tasks` is a sensitive OAuth scope. A bundled client ID (true
  zero-setup) requires Google app verification and is capped at 100 users until approved, and
   shows an "unverified app" interstitial before that. The plan therefore builds **one** flow that
   reads its client credentials from config: bundled if present, user-supplied otherwise. The
   product flow you described is identical in both cases.
2. **Loopback listener inside the plugin sandbox.** Joplin core itself uses a local `http` server
  for OneDrive OAuth and an existing community plugin does Google OAuth, so this is very likely
   fine — but it is unproven for *our* sandbox. M0 includes a throwaway spike to prove
   `http.createServer` + `fetch` work inside a real installed plugin before anything is built on it.
   Fallback if it fails: `joplin.views.panels` webview + a `joplin://` handler, or code paste.

---



## Architecture

Hexagonal. The rule enforced by lint and by CLAUDE.md: `src/core/` **imports nothing from** `api/`
**(Joplin) or from any HTTP library.** It is plain data in, plain data out, so it is trivially and
exhaustively testable.

```
src/
  index.ts                 # joplin.plugins.register — wiring only, no logic
  ports.ts                 # JoplinSide, GoogleSide, Clock, Logger interfaces
  core/                    # PURE — 100% of the TDD effort lands here
    model.ts               # CanonicalTask, LinkState, SyncPlan, Op, Conflict
    mapping.ts             # note <-> CanonicalTask <-> task
    duedate.ts             # date-only normalisation, tz rules
    diff.ts                # (base, current) -> FieldChanges
    merge.ts               # 3-way merge + conflict detection
    planner.ts             # (locals, remotes, links) -> SyncPlan
    reconcile.ts           # (plan, results) -> next LinkStates
  plugin/                  # Joplin adapters — thin, integration-tested only
    joplinRepo.ts          # implements JoplinSide over joplin.data
    linkStore.ts           # LinkState via userData (note) + pairing via userData (folder)
    settings.ts, commands.ts, scheduler.ts, dialogs/
  google/                  # Google adapters — thin
    authClient.ts          # PKCE + loopback capture + refresh
    tasksClient.ts         # implements GoogleSide over REST
    http.ts                # retry/backoff, 429 + 5xx handling
test/
  core/*.spec.ts           # unit, exhaustive
  fakes/                   # InMemoryJoplinSide, InMemoryGoogleTasks (behavioural fakes)
  scenarios/*.spec.ts      # full sync runs over both fakes
  contract/*.spec.ts       # tasksClient/authClient vs recorded fixtures (msw)
docs/
```



### Canonical model

```ts
type CanonicalTask = {
  title: string;
  body: string;
  due: PlainDate | null;      // 'YYYY-MM-DD' — Google's resolution, not Joplin's
  completed: boolean;
  completedAt: number | null;
};
```

`LinkState` is the **base** for the 3-way merge, stored per note in userData key `gtasks`:

```ts
type LinkState = {
  v: 1;
  listId: string; taskId: string;
  base: CanonicalTask;          // last agreed value
  localDueMs: number | null;    // full-precision Joplin due we pushed (see below)
  joplinUpdatedTime: number;    // note.updated_time right after our write
  googleUpdated: string;        // task.updated right after our write
  googleEtag?: string;
  googleParent?: string;        // preserve subtask parent across round-trips
};
```

Notebook⟷list pairing lives in **folder** userData (`gtasks-list`), so pairings sync across
devices. Poll cursors and OAuth tokens live in plugin settings (device-local, secret for tokens).

### The three mappings that need care

- **Due dates.** Joplin's `todo_due` carries a time; Google keeps only the date. We store the
original `localDueMs` in the link state; a remote `due` counts as changed only when its *date
part* differs from the base date part. Otherwise every sync would see a "remote change" and
rewrite the local time-of-day away.
- **Subtasks.** Google `parent` is output-only and Joplin notes are flat. v1 flattens, preserving
`googleParent` in link state so a round-trip doesn't reparent anything. Documented as a known gap.
- **Deletion.** Joplin soft-deletes (`deleted_time`) and Google returns deleted tasks with
`deleted: true`. A link whose note is gone but whose task exists → delete remotely, and vice
versa. The persisted link index is what distinguishes "deleted" from "never synced".



### Sync algorithm (pure)

`plan(pair, localNotes, remoteTasks, links, now) -> SyncPlan` classifies every item:


| Situation                             | Op                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| local only, unlinked                  | `CreateRemote`                                                                                                     |
| remote only, unlinked                 | `CreateLocal`                                                                                                      |
| linked, both present                  | diff local vs base, remote vs base → `merge` → `UpdateLocal` / `UpdateRemote` / both / none / `+WriteConflictNote` |
| linked, local gone                    | `DeleteRemote`                                                                                                     |
| linked, remote gone or `deleted:true` | `DeleteLocal`                                                                                                      |


Ops are inert data; an executor applies them through the ports; the reconciler folds results into
new `LinkState`s. Nothing in `core/` performs I/O, so every branch above is a table-driven test.

### Invariants the test suite must enforce

1. **Idempotence** — sync with no changes on either side produces an empty plan.
2. **Convergence** — apply a plan, re-read both fakes, sync again → empty plan.
3. **No echo** — our own writes must not register as remote changes next round.
4. **No silent loss** — every discarded value appears in a conflict note.
5. **No resurrection** — a deleted item stays deleted across repeated syncs.
6. **Truncation is visible** — a >8192-char body is truncated and reported, never silently cut.

---



## Milestones (TDD order)

**M0 — Scaffold, docs, agent files.** *This is the first commit and contains no feature code.*

- `yo joplin` scaffold; add Vitest, ESLint, `tsc --noEmit`; `npm test` / `lint` / `dist` all green.
- `CLAUDE.md` — the working agreement: red-green-refactor, `core/` purity rule, ports-only I/O,
no feature code without a failing test first, commands, layout, commit style.
- `AGENTS.md` → pointer to CLAUDE.md.
- `docs/ARCHITECTURE.md`, `docs/SYNC-DESIGN.md` (algorithm + the six invariants),
`docs/DATA-MODEL.md` (field mapping table incl. lossy cases), `docs/TESTING.md` (test taxonomy,
how to use the fakes), `docs/adr/0001-hexagonal-core.md`, `0002-userdata-for-link-state.md`,
`0003-oauth-loopback.md`, `docs/SETUP-GOOGLE-OAUTH.md`, `README.md`.
- **Spike (throwaway):** prove `http.createServer` + `fetch` work inside an installed dev plugin.
Record the outcome in ADR 0003 and delete the spike code.

**M1 — Core model + mapping.** `model.ts`, `duedate.ts`, `mapping.ts`. Round-trip property tests:
note → canonical → note is identity for representable values; truncation and due-date rules
explicit.

**M2 — Diff + merge.** `diff.ts`, `merge.ts`. Table-driven over the base/local/remote matrix,
including the field-merge and conflict-note cases you picked.

**M3 — Planner + reconciler + fakes.** In-memory `JoplinSide` and `GoogleTasksClient` fakes that
behave like the real thing (Google discards due times, bumps `updated`, hides completed tasks).
Scenario tests assert invariants 1–6 end to end.

**M4 — Google adapters.** `authClient.ts` (PKCE, loopback capture, refresh, secure token storage),
`tasksClient.ts`, `http.ts` (backoff on 429/5xx, pagination, `updatedMin`). Contract tests against
recorded fixtures via msw.

**M5 — Joplin adapters.** `joplinRepo.ts`, `linkStore.ts`, settings registration, notebook⟷list
pairing dialog.

**M6 — Wiring.** `Sync now` command, periodic scheduler with a single-flight lock, conflict-note
writer, error surfacing, sync log.

**M7 — Ship.** Packaging, README with the OAuth setup walkthrough, manual E2E checklist.

---



## Verification

Automated, at every milestone:

```bash
npm test        # vitest — unit + scenario + contract
npm run lint    # eslint + tsc --noEmit (incl. the core-purity import rule)
npm run dist    # webpack → publish/*.jpl must build
```

Manual E2E once M6 lands, against a **separate Joplin dev profile** (never the real one):

1. Install the dev plugin, click *Authenticate* → browser SSO → Joplin shows "Connected as …".
2. Pair a scratch notebook with a scratch Google list; run *Sync now* → both sides match.
3. Edit only in Joplin → sync → change appears in Google Tasks (and not the reverse).
4. Edit only in Google → sync → change appears in Joplin.
5. Change the *same* field on both sides → sync → merged value wins, conflict note holds the loser.
6. Change *different* fields on both sides → sync → both survive.
7. Delete on each side in turn → sync → the peer is deleted and stays deleted after a re-sync.
8. Run *Sync now* twice with no changes → second run reports zero operations (the echo check).



## Explicitly out of scope for v1

Google subtask hierarchy and ordering (`position`), recurring tasks, attachments/links, mobile
Joplin, syncing non-todo notes, and real-time push (Tasks has no webhooks — polling only).