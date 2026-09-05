# Google Tasks Sync (Joplin plugin)

Two-way sync between a Joplin **notebook** and a Google **task list**. To-dos created or completed on a phone (Google Tasks) show up in Joplin, and vice versa.

This is a Joplin **desktop** plugin. v1 does not target mobile.

## Status

The sync core, adapters, and wiring land across stacked PRs (milestones M0–M7). See [docs/PLAN.md](docs/PLAN.md).

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

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Sync design](docs/SYNC-DESIGN.md)
- [Data model](docs/DATA-MODEL.md)
- [Testing](docs/TESTING.md)
- [Plan](docs/PLAN.md)

## License

MIT
