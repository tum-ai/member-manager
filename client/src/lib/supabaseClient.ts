import { createClient } from "@supabase/supabase-js";

type SupabaseBrowserEnv = {
	PROD: boolean;
	VITE_SUPABASE_URL?: string;
	VITE_SUPABASE_ANON_KEY?: string;
};

function allowInsecureTransport(hostname: string): boolean {
	return hostname === "127.0.0.1" || hostname === "localhost";
}

function requireEnv(rawValue: string | undefined, envName: string): string {
	const value = rawValue?.trim();

	if (!value) {
		throw new Error(
			`Missing ${envName}. Add it to client/.env.local or client/.env.`,
		);
	}

	return value;
}

function parseUrl(rawUrl: string, envName: string): URL {
	try {
		return new URL(rawUrl);
	} catch {
		throw new Error(`${envName} must be a valid URL`);
	}
}

function assertSecureRemoteUrl(
	rawUrl: string,
	envName: string,
	isProduction: boolean,
): void {
	const parsedUrl = parseUrl(rawUrl, envName);

	if (
		isProduction &&
		parsedUrl.protocol !== "https:" &&
		!allowInsecureTransport(parsedUrl.hostname)
	) {
		throw new Error(`${envName} must use HTTPS in production`);
	}
}

export function getSupabaseConfigFromEnv(env: SupabaseBrowserEnv): {
	supabaseUrl: string;
	supabaseAnonKey: string;
} {
	const supabaseUrl = requireEnv(env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL");
	const supabaseAnonKey = requireEnv(
		env.VITE_SUPABASE_ANON_KEY,
		"VITE_SUPABASE_ANON_KEY",
	);

	assertSecureRemoteUrl(supabaseUrl, "VITE_SUPABASE_URL", env.PROD);

	return { supabaseUrl, supabaseAnonKey };
}

const { supabaseUrl, supabaseAnonKey } = getSupabaseConfigFromEnv(
	import.meta.env,
);

// Supabase-js has no built-in per-request timeout. If the project URL is
// unreachable (DNS failure, paused project, offline) the default browser
// fetch can sit for tens of seconds and the auto-refresh loop will retry,
// freezing any UI that awaits auth calls. Wrap fetch with an AbortController
// so every Supabase request fails fast instead.
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(
	input: RequestInfo | URL,
	init: RequestInit = {},
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		SUPABASE_FETCH_TIMEOUT_MS,
	);

	const signal = init.signal
		? mergeSignals(init.signal, controller.signal)
		: controller.signal;

	return fetch(input, { ...init, signal }).finally(() => {
		clearTimeout(timeoutId);
	});
}

function mergeSignals(
	external: AbortSignal,
	internal: AbortSignal,
): AbortSignal {
	if (external.aborted) return external;
	if (internal.aborted) return internal;

	const controller = new AbortController();
	const onAbort = (): void => controller.abort();
	external.addEventListener("abort", onAbort, { once: true });
	internal.addEventListener("abort", onAbort, { once: true });
	return controller.signal;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	global: { fetch: fetchWithTimeout },
});
