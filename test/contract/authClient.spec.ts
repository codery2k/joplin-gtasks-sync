import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GoogleAuthClient, OAuthTokens, TokenStore, pkce } from '../../src/google/authClient';

const server = setupServer();

describe('GoogleAuthClient', () => {
	beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
	afterEach(() => server.resetHandlers());
	afterAll(() => server.close());

	it('refuses to start OAuth when client ID is missing', async () => {
		const opened: string[] = [];
		const store: TokenStore = {
			async load() {
				return null;
			},
			async save() {},
			async clear() {},
		};

		const client = new GoogleAuthClient({ clientId: '', clientSecret: '' }, store, {
			openUrl: async (url) => {
				opened.push(url);
			},
		});

		await expect(client.authenticate()).rejects.toThrow(/client ID/i);
		expect(opened).toEqual([]);
	});

	it('reports connected only when tokens are stored', async () => {
		let tokens: OAuthTokens | null = null;
		const store: TokenStore = {
			async load() {
				return tokens;
			},
			async save(next) {
				tokens = next;
			},
			async clear() {
				tokens = null;
			},
		};

		const client = new GoogleAuthClient({ clientId: 'id', clientSecret: 'secret' }, store, {
			openUrl: async () => {},
		});

		await expect(client.isConnected()).resolves.toBe(false);

		await store.save({
			accessToken: 'tok',
			expiresAt: Date.now() + 60_000,
		});
		await expect(client.isConnected()).resolves.toBe(true);

		await store.clear();
		await expect(client.isConnected()).resolves.toBe(false);
	});

	it('creates a PKCE verifier and S256 challenge', () => {
		const { verifier, challenge } = pkce();
		expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(verifier).not.toBe(challenge);
	});

	it('refreshes an expired access token', async () => {
		const saved: OAuthTokens[] = [];
		const store: TokenStore = {
			async load() {
				return {
					accessToken: 'old',
					refreshToken: 'refresh-me',
					expiresAt: 1,
					email: 'user@example.com',
				};
			},
			async save(tokens) {
				saved.push(tokens);
			},
			async clear() {},
		};

		server.use(
			http.post('https://oauth2.googleapis.com/token', async ({ request }) => {
				const body = await request.text();
				expect(body).toContain('grant_type=refresh_token');
				expect(body).toContain('refresh-me');
				return HttpResponse.json({
					access_token: 'new-access',
					expires_in: 3600,
				});
			}),
			http.get('https://www.googleapis.com/oauth2/v2/userinfo', () =>
				HttpResponse.json({ email: 'user@example.com' }),
			),
		);

		const client = new GoogleAuthClient({ clientId: 'id', clientSecret: 'secret' }, store, {
			openUrl: async () => {},
			now: () => 1000,
		});

		await expect(client.getAccessToken()).resolves.toBe('new-access');
		expect(saved[0]?.accessToken).toBe('new-access');
		expect(saved[0]?.refreshToken).toBe('refresh-me');
		expect(saved[0]?.email).toBe('user@example.com');
	});
});
