# Testing

## Taxonomy

| Kind | Where | What |
| --- | --- | --- |
| Unit | `test/core/*.spec.ts` | Mapping, due dates, diff, merge, planner, reconciler. Table-driven. |
| Fakes | `test/fakes/` | `InMemoryJoplinSide`, `InMemoryGoogleTasks` — behavioural, not stubs. |
| Scenario | `test/scenarios/*.spec.ts` | Full plan → apply → reconcile → re-plan over both fakes. Enforces the six invariants. |
| Contract | `test/contract/*.spec.ts` | `tasksClient` / `authClient` against recorded fixtures via msw. |

`src/core/` is 100% of the TDD surface. Adapters stay thin; do not hide merge rules in them.

## How to use the fakes

The Google fake must behave like Tasks:

- `due` keeps the date and drops the time (normalise to `YYYY-MM-DDT00:00:00.000Z`)
- every write bumps `updated` and `etag`
- completed tasks are hidden from a default list unless `showCompleted` / `showHidden` is set
- `deleted: true` tasks appear only when `showDeleted` is set
- `parent` / `position` are output-only (accepted on create if we already have them on the resource; ignored as write inputs)

The Joplin fake must behave like notes:

- `is_todo` notes only participate
- `todo_due` is ms epoch (time-of-day preserved)
- `todo_completed` is ms epoch, `0` when open
- `updated_time` bumps on every write
- `deleted_time` is a soft delete
- userData is a per-item key/value map (link state)

Scenario tests should go through `plan` + an in-test executor + `reconcile`, then assert the next plan is empty (convergence / no echo).

## Running

```bash
npm test        # vitest run
npm run lint    # eslint + tsc --noEmit
npm run dist    # .jpl archive
```

## Manual E2E

Once wiring lands, run the checklist in [PLAN.md](./PLAN.md#verification) against a **separate Joplin dev profile**.
