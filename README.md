# Google Tasks Sync (Joplin plugin)

Two-way sync between a Joplin **notebook** and a Google **task list**. To-dos created or completed on a phone (Google Tasks) show up in Joplin, and vice versa.

This is a Joplin **desktop** plugin. v1 does not target mobile.

## Status

v1 desktop plugin: notebook ⟷ task list, field-level 3-way merge, conflict notes, PKCE + loopback OAuth.

See [docs/PLAN.md](docs/PLAN.md) and [docs/E2E.md](docs/E2E.md).

## Develop

Requires Node 18+.

```bash
npm install
npm test
npm run lint
npm run dist
```

Load the plugin in a **separate Joplin dev profile** (never your real one):

1. Joplin → Settings → Plugins → Advanced → Development plugins
2. Point it at this repository root
3. Restart Joplin

The built archive is `publish/com.codery2k.JoplinGTasksSync.jpl`.

## Google OAuth

The plugin reads OAuth client credentials from settings: bundled if present, user-supplied otherwise. The product flow is the same in both cases.

Full walkthrough: [docs/SETUP-GOOGLE-OAUTH.md](docs/SETUP-GOOGLE-OAUTH.md).

## Usage

1. Create a Google OAuth desktop client and enable the Tasks API ([walkthrough](docs/SETUP-GOOGLE-OAUTH.md)).
2. Joplin → Settings → Google Tasks Sync → paste client ID / secret.
3. Tools → **Google Tasks: Authenticate**.
4. Tools → **Google Tasks: Pair notebook…**
5. Tools → **Google Tasks: Sync now** (or wait for the interval).

Conflict notes are created in the paired notebook when the same field changes on both sides, or when Google truncates a title/body. They are not to-dos and are not synced back to Google.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Sync design](docs/SYNC-DESIGN.md)
- [Data model](docs/DATA-MODEL.md)
- [Testing](docs/TESTING.md)
- [Manual E2E](docs/E2E.md)
- [Plan](docs/PLAN.md)

## License

MIT
