# Working agreement

This is a Joplin desktop plugin that two-way-syncs a notebook with a Google Tasks list. The hard part is silent data loss and sync loops, not calling APIs. Treat the sync core as the product.

## TDD

Red-green-refactor. No feature code without a failing test first.

- `src/core/` is where 100% of the TDD effort lands.
- Adapters in `src/plugin/` and `src/google/` are thin. Cover them with contract / integration tests, not by stuffing logic into them.

## Purity rule

`src/core/` **imports nothing from** `api/` (Joplin) or from any HTTP library. Plain data in, plain data out.

ESLint enforces this (`no-restricted-imports` on `src/core/**`). Do not disable that rule to "get something working". Push I/O to a port instead.

## Ports-only I/O

All side effects go through `src/ports.ts` (`JoplinSide`, `GoogleSide`, `Clock`, `Logger`). The planner and reconciler return inert data. An executor outside `core/` applies ops.

## Layout

```
src/index.ts                 # joplin.plugins.register — wiring only
src/ports.ts                 # port interfaces
src/core/                    # PURE
src/plugin/                  # Joplin adapters
src/google/                  # Google adapters
test/core/                   # unit
test/fakes/                  # behavioural fakes
test/scenarios/              # full sync runs over both fakes
test/contract/               # adapters vs recorded fixtures (msw)
```

## Commands

```bash
npm test        # vitest — unit + scenario + contract
npm run lint    # eslint + tsc --noEmit (includes the core-purity rule)
npm run dist    # webpack → publish/*.jpl
```

All three must stay green.

## Commit style

Conventional, imperative, why over what. One concern per commit.

```
feat(core): merge same-field clashes into a conflict note
fix(google): treat 410 on updatedMin as a full resync
test(scenarios): cover no-resurrection after a remote delete
docs: record due-date date-only rule
```

## Invariants the suite must keep true

1. Idempotence — no-change sync produces an empty plan.
2. Convergence — apply a plan, re-read, sync again → empty plan.
3. No echo — our own writes are not remote changes next round.
4. No silent loss — every discarded value appears in a conflict note.
5. No resurrection — a deleted item stays deleted across repeated syncs.
6. Truncation is visible — a >8192-char body is truncated and reported.

## Out of scope for v1

Google subtask hierarchy and ordering, recurring tasks, attachments, mobile Joplin, non-todo notes, real-time push.
