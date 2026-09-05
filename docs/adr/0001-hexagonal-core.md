# ADR 0001 — Hexagonal sync core

## Status

Accepted

## Context

Two-way sync between Joplin and Google Tasks can lose data or loop if merge rules live next to HTTP and `joplin.data` calls. Those I/O surfaces are awkward to unit-test inside a plugin.

## Decision

Put the entire algorithm in `src/core/`: model, mapping, due-date rules, diff, merge, planner, reconciler. Core takes plain snapshots and returns a `SyncPlan`. Joplin and Google sit behind `JoplinSide` / `GoogleSide` ports.

ESLint forbids `src/core/` from importing `api/` or HTTP libraries.

## Consequences

- Exhaustive table tests and scenario tests over in-memory fakes.
- Adapters stay thin and are covered by contract tests.
- Slightly more types and mapping code up front.
