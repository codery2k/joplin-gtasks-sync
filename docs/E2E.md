# Manual E2E checklist

Run this against a **separate Joplin desktop profile**. Never point the development plugin at your real notes.

1. Install the dev plugin (`npm run dist`, then Settings → Plugins → Advanced → Development plugins → this repo). Click **Google Tasks: Authenticate** → browser SSO → Joplin shows "Connected as …".
2. Pair a scratch notebook with a scratch Google list; run **Google Tasks: Sync now** → both sides match.
3. Edit only in Joplin → sync → change appears in Google Tasks (and not the reverse).
4. Edit only in Google → sync → change appears in Joplin.
5. Change the *same* field on both sides → sync → merged value wins, conflict note holds the loser.
6. Change *different* fields on both sides → sync → both survive.
7. Delete on each side in turn → sync → the peer is deleted and stays deleted after a re-sync.
8. Run **Sync now** twice with no changes → second run reports zero operations (the echo check).
9. Confirm the OAuth loopback worked inside the plugin sandbox (see [adr/0003-oauth-loopback.md](./adr/0003-oauth-loopback.md)). If it did not, use the paste-URL fallback.

OAuth setup: [SETUP-GOOGLE-OAUTH.md](./SETUP-GOOGLE-OAUTH.md).
