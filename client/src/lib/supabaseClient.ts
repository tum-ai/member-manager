import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function allowInsecureTransport(hostname: string): boolean {
	return hostname === "127.0.0.1" || hostname === "localhost";
}

function assertSecureRemoteUrl(rawUrl: string, envName: string): void {
	const parsedUrl = new URL(rawUrl);

	if (
		import.meta.env.PROD &&
		parsedUrl.protocol !== "https:" &&
		!allowInsecureTransport(parsedUrl.hostname)
	) {
		throw new Error(`${envName} must use HTTPS in production`);
	}
}

assertSecureRemoteUrl(supabaseUrl, "VITE_SUPABASE_URL");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
