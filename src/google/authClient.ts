import { createHash, randomBytes } from 'crypto';
import http from 'http';
import { requestJson } from './http';

export const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
export const USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

export type OAuthTokens = {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	email?: string;
};

export type OAuthConfig = {
	clientId: string;
	clientSecret?: string;
};

export type OAuthConfigSource = OAuthConfig | (() => Promise<OAuthConfig> | OAuthConfig);

export interface TokenStore {
	load(): Promise<OAuthTokens | null>;
	save(tokens: OAuthTokens): Promise<void>;
	clear(): Promise<void>;
}

export type AuthDeps = {
	openUrl: (url: string) => Promise<void> | void;
	fetch?: typeof fetch;
	now?: () => number;
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const MISSING_CLIENT_ID =
	'Google OAuth client ID is not set. Open Settings → Google Tasks Sync and paste a Desktop client ID and secret.';

export class GoogleAuthClient {
	constructor(
		private readonly configSource: OAuthConfigSource,
		private readonly store: TokenStore,
		private readonly deps: AuthDeps,
	) {}

	private async resolveConfig(): Promise<OAuthConfig> {
		const config = typeof this.configSource === 'function' ? await this.configSource() : this.configSource;
		if (!config.clientId.trim()) {
			throw new Error(MISSING_CLIENT_ID);
		}
		return { ...config, clientSecret: config.clientSecret || undefined };
	}

	async getAccessToken(): Promise<string> {
		const tokens = await this.ensureTokens();
		return tokens.accessToken;
	}

	async isConnected(): Promise<boolean> {
		return (await this.store.load()) !== null;
	}

	async connectedEmail(): Promise<string | null> {
		const tokens = await this.store.load();
		return tokens?.email ?? null;
	}

	async authenticate(): Promise<OAuthTokens> {
		const config = await this.resolveConfig();
		const { verifier, challenge } = pkce();
		const { port, waitForCode, close } = await listenForRedirect();
		const redirectUri = `http://127.0.0.1:${port}/`;
		const state = randomBytes(16).toString('hex');
		const url = new URL(AUTH_URL);
		url.searchParams.set('client_id', config.clientId);
		url.searchParams.set('redirect_uri', redirectUri);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', TASKS_SCOPE);
		url.searchParams.set('code_challenge', challenge);
		url.searchParams.set('code_challenge_method', 'S256');
		url.searchParams.set('state', state);
		url.searchParams.set('access_type', 'offline');
		url.searchParams.set('prompt', 'consent');

		try {
			await this.deps.openUrl(url.toString());
			const { code, returnedState } = await waitForCode();
			if (returnedState !== state) {
				throw new Error('OAuth state mismatch');
			}
			const tokens = await this.exchangeCode(config, code, redirectUri, verifier);
			await this.store.save(tokens);
			return tokens;
		} finally {
			close();
		}
	}

	async disconnect(): Promise<void> {
		await this.store.clear();
	}

	private async ensureTokens(): Promise<OAuthTokens> {
		const existing = await this.store.load();
		if (!existing) {
			throw new Error('Not authenticated with Google Tasks');
		}
		const now = (this.deps.now ?? Date.now)();
		if (existing.expiresAt - 60_000 > now) {
			return existing;
		}
		if (!existing.refreshToken) {
			throw new Error('Google access token expired and no refresh token is stored');
		}
		const refreshed = await this.refresh(await this.resolveConfig(), existing.refreshToken, existing.email);
		const merged: OAuthTokens = {
			...existing,
			...refreshed,
			refreshToken: refreshed.refreshToken ?? existing.refreshToken,
		};
		await this.store.save(merged);
		return merged;
	}

	private async exchangeCode(
		config: OAuthConfig,
		code: string,
		redirectUri: string,
		verifier: string,
	): Promise<OAuthTokens> {
		const body = new URLSearchParams({
			client_id: config.clientId,
			code,
			code_verifier: verifier,
			grant_type: 'authorization_code',
			redirect_uri: redirectUri,
		});
		if (config.clientSecret) body.set('client_secret', config.clientSecret);
		return this.tokenRequest(body);
	}

	private async refresh(config: OAuthConfig, refreshToken: string, email?: string): Promise<OAuthTokens> {
		const body = new URLSearchParams({
			client_id: config.clientId,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		});
		if (config.clientSecret) body.set('client_secret', config.clientSecret);
		const tokens = await this.tokenRequest(body);
		return { ...tokens, email: tokens.email ?? email };
	}

	private async tokenRequest(body: URLSearchParams): Promise<OAuthTokens> {
		const now = (this.deps.now ?? Date.now)();
		const json = await requestJson<{
			access_token: string;
			refresh_token?: string;
			expires_in: number;
		}>(
			{
				url: TOKEN_URL,
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: body.toString(),
			},
			{ fetch: this.deps.fetch },
		);
		const tokens: OAuthTokens = {
			accessToken: json.access_token,
			refreshToken: json.refresh_token,
			expiresAt: now + json.expires_in * 1000,
		};
		try {
			const user = await requestJson<{ email?: string }>(
				{
					url: USERINFO_URL,
					headers: { authorization: `Bearer ${tokens.accessToken}` },
				},
				{ fetch: this.deps.fetch },
			);
			tokens.email = user.email;
		} catch {
			// email is cosmetic
		}
		return tokens;
	}
}

export function pkce(): { verifier: string; challenge: string } {
	const verifier = randomBytes(32).toString('base64url');
	const challenge = createHash('sha256').update(verifier).digest('base64url');
	return { verifier, challenge };
}

function listenForRedirect(): Promise<{
	port: number;
	waitForCode: () => Promise<{ code: string; returnedState: string }>;
	close: () => void;
}> {
	return new Promise((resolve, reject) => {
		const server = http.createServer();
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				reject(new Error('failed to bind OAuth loopback'));
				return;
			}
			const waitForCode = () =>
				new Promise<{ code: string; returnedState: string }>((resolveCode, rejectCode) => {
					const timer = setTimeout(() => rejectCode(new Error('OAuth timed out')), 5 * 60_000);
					server.on('request', (req, res) => {
						const url = new URL(req.url ?? '/', `http://127.0.0.1:${address.port}`);
						const code = url.searchParams.get('code');
						const state = url.searchParams.get('state') ?? '';
						const err = url.searchParams.get('error');
						res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
						if (err || !code) {
							res.end('<p>Authentication failed. You can close this window.</p>');
							clearTimeout(timer);
							rejectCode(new Error(err ?? 'missing OAuth code'));
							return;
						}
						res.end('<p>Connected. You can close this window and return to Joplin.</p>');
						clearTimeout(timer);
						resolveCode({ code, returnedState: state });
					});
				});
			resolve({
				port: address.port,
				waitForCode,
				close: () => server.close(),
			});
		});
		server.on('error', reject);
	});
}
