# Architecture

Hexagonal. The sync algorithm is a pure function of snapshots. Joplin and Google are adapters behind ports.

```
src/
  index.ts                 # joplin.plugins.register — wiring only, no logic
  ports.ts                 # JoplinSide, GoogleSide, Clock, Logger
  core/                    # PURE — no api/, no HTTP
    model.ts
    mapping.ts
    duedate.ts
    diff.ts
    merge.ts
    planner.ts
    reconcile.ts
  plugin/                  # Joplin adapters
    joplinRepo.ts
    linkStore.ts
    settings.ts
    commands.ts
    scheduler.ts
    dialogs/
  google/                  # Google adapters
    authClient.ts
    tasksClient.ts
    http.ts
test/
  core/*.spec.ts
  fakes/
  scenarios/*.spec.ts
  contract/*.spec.ts
```

## Why hexagonal

Two-way sync fails in the gaps: echo, resurrection, silent truncation, same-field clashes. Those bugs are cheapest to kill when the algorithm can be table-tested with no network and no Joplin.

`src/core/` therefore imports nothing from `api/` or any HTTP library. ESLint enforces that. Adapters implement the ports and are integration-tested only.

## Data flow

```
JoplinSide + GoogleSide + LinkStore
        │
        ▼
   planner.plan(...)   →   SyncPlan (inert ops)
        │
        ▼
   executor (plugin) applies ops through ports
        │
        ▼
   reconcile(...)      →   next LinkStates
```

Nothing in `core/` writes a note or a task. Ops are data. The executor is the only place I/O happens after planning.

## Where state lives

| State | Home | Why |
| --- | --- | --- |
| Per-note `LinkState` | Note userData key `gtasks` | Synced across devices, last-write-wins per key, note body stays clean |
| Notebook ⟷ list pairing | Folder userData key `gtasks-list` | Pairings follow the notebook across devices |
| OAuth tokens | Plugin setting, `secure: true` | Device-local, keychain-backed |
| Poll cursors | Plugin settings | Device-local; a cursor is not meaningful on another machine |

See [DATA-MODEL.md](./DATA-MODEL.md) and [adr/0002-userdata-for-link-state.md](./adr/0002-userdata-for-link-state.md).

## Auth

Settings → *Authenticate* → system browser → Google SSO → loopback capture back into Joplin. One flow, credentials from config (bundled or user-supplied). See [adr/0003-oauth-loopback.md](./adr/0003-oauth-loopback.md) and [SETUP-GOOGLE-OAUTH.md](./SETUP-GOOGLE-OAUTH.md).
