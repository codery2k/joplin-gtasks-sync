# ADR 0002 — userData for link state

## Status

Accepted

## Context

Each synced to-do needs a durable `LinkState` (remote id, last agreed canonical value, echo tokens, original Joplin due ms). Putting that in the note body would pollute the document and fight the user.

Joplin exposes `joplin.data.userDataGet/Set/Delete(ModelType, itemId, key, value)`: arbitrary JSON on a note or folder, **synced across devices**, merged last-write-wins per key.

## Decision

- Per-note link state → note userData key `gtasks`.
- Notebook ⟷ task-list pairing → folder userData key `gtasks-list`.
- OAuth tokens and poll cursors stay in plugin settings (device-local; tokens `secure: true`).

## Consequences

- Link state follows the note to other desktops that run the plugin.
- A last-write-wins clash on the `gtasks` key itself is possible if two devices sync the same note at once; the next planner pass still 3-way-merges against whatever base survived.
- Settings are the right place for secrets and for cursors that are meaningless on another machine.
