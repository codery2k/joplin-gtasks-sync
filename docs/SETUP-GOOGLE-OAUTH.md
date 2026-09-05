# Set up Google OAuth

The plugin uses one auth flow: Settings → *Authenticate* → system browser → Google SSO → captured back in Joplin. Client credentials come from config — bundled if present, otherwise you paste your own.

`https://www.googleapis.com/auth/tasks` is a **sensitive** scope. A bundled client ID needs Google app verification, is capped at 100 users until approved, and shows an "unverified app" interstitial before that.

## Create a Google Cloud OAuth client (user-supplied)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or pick a project.
3. Enable the **Google Tasks API**.
4. APIs & Services → OAuth consent screen.
   - User type: **External** (or Internal if this is a Workspace-only install).
   - App name, support email, developer contact.
   - Scope: `https://www.googleapis.com/auth/tasks`.
   - Add your Google account as a test user while the app is in Testing.
5. APIs & Services → Credentials → Create credentials → OAuth client ID.
   - Application type: **Desktop app**.
   - Name it e.g. `Joplin Google Tasks Sync`.
6. Copy the client ID and client secret.

## Paste credentials into Joplin

1. Joplin → Settings → Google Tasks Sync.
2. Paste **Client ID** and **Client secret**.
3. Click **Authenticate**.
4. Sign in in the browser. Grant the Tasks scope.
5. The browser should bounce to `http://127.0.0.1:<port>/...` and Joplin should show **Connected as …**.

If the loopback page fails to load, see [adr/0003-oauth-loopback.md](./adr/0003-oauth-loopback.md) for the fallback (paste the redirect URL / code).

## Bundled credentials

If a verified (or testing) client is compiled into the plugin, leave the client ID / secret settings empty. Authenticate still runs the same browser flow.

Do not commit real client secrets. Use CI / local env if we later embed a client; `.gitignore` already excludes `credentials.json` and `client_secret*.json`.

## Tokens

Refresh and access tokens are stored in a **secure** plugin setting (system keychain when Joplin can use one). They are device-local and never written to note userData.
