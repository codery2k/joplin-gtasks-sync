# ADR 0003 — OAuth loopback capture

## Status

Accepted (sandbox spike pending a live Joplin install)

## Context

Auth UX is Settings → *Authenticate* → system browser → Google SSO → captured back in Joplin automatically. That needs a loopback HTTP listener plus `fetch` for the token exchange (PKCE).

The plugin runs in Joplin's Electron plugin sandbox. Whether `http.createServer` and `fetch` work there was unproven for *this* plugin, though Joplin core uses a local `http` server for OneDrive OAuth and at least one community plugin already does Google OAuth.

## Decision

Primary flow: PKCE + `http.createServer` on `127.0.0.1` + system browser + token `fetch`.

Fallback if the sandbox blocks the listener: `joplin.views.panels` webview and/or a `joplin://` handler, or a "paste the redirect URL" dialog.

One credential path: read client id/secret from settings, bundled default if present.

## Spike

A throwaway Node script (`http.createServer` + `fetch` against the loopback) was run on the development machine. Outcome:

- Node 24: listener binds `127.0.0.1`, serves a capture page, `fetch` to that origin succeeds (`http://127.0.0.1:<ephemeral>/` returned `200 ok`).
- This is **not** the Joplin plugin sandbox. In-app confirmation is part of the M7 manual E2E checklist (step 1: Authenticate).
- We still adopt loopback as the primary design because Joplin core and existing plugins already do it. If M7 fails, switch to the fallback above — the auth client should keep the token exchange and storage behind the same interface.

Spike source was deleted after recording this outcome (M0 contains no feature code).
