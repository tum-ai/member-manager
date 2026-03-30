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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
