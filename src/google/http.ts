export type HttpRequest = {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
};

export type HttpResponse = {
	status: number;
	headers: Headers;
	text: string;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body: string,
	) {
		super(message);
	}
}

export function describeError(error: unknown): string {
	if (error instanceof HttpError) {
		const detail = googleErrorDetail(error.body);
		return detail ? `${error.message} — ${detail}` : error.message;
	}
	if (error instanceof Error) return error.message;
	return String(error);
}

function googleErrorDetail(body: string): string | undefined {
	if (!body) return undefined;
	try {
		const parsed = JSON.parse(body) as {
			error?: { message?: string } | string;
			error_description?: string;
		};
		if (typeof parsed.error === 'string') return parsed.error_description ?? parsed.error;
		return parsed.error?.message ?? parsed.error_description;
	} catch {
		return body;
	}
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export async function requestWithBackoff(
	req: HttpRequest,
	opts: { fetch?: FetchLike; sleep?: (ms: number) => Promise<void>; maxRetries?: number } = {},
): Promise<HttpResponse> {
	const fetchFn = opts.fetch ?? fetch;
	const sleep = opts.sleep ?? defaultSleep;
	const maxRetries = opts.maxRetries ?? 4;
	let attempt = 0;

	while (true) {
		const response = await fetchFn(req.url, {
			method: req.method ?? 'GET',
			headers: req.headers,
			body: req.body,
		});
		const text = await response.text();
		if (response.ok) {
			return { status: response.status, headers: response.headers, text };
		}

		if (!RETRYABLE.has(response.status) || attempt >= maxRetries) {
			throw new HttpError(`HTTP ${response.status} ${req.method ?? 'GET'} ${req.url}`, response.status, text);
		}

		const retryAfter = Number(response.headers.get('retry-after'));
		const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
		attempt += 1;
		await sleep(backoff);
	}
}

export async function requestJson<T>(
	req: HttpRequest,
	opts?: { fetch?: FetchLike; sleep?: (ms: number) => Promise<void>; maxRetries?: number },
): Promise<T> {
	const response = await requestWithBackoff(req, opts);
	if (!response.text) return {} as T;
	return JSON.parse(response.text) as T;
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
