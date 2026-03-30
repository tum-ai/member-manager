import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { assertSecureRemoteUrl } from "./sensitiveData.js";

const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);

function resolveEnvPath(envPath: string): string {
	return path.isAbsolute(envPath)
		? envPath
		: path.resolve(packageRoot, envPath);
}

// Support custom .env file path via DOTENV_CONFIG_PATH for local development
const envPath = process.env.DOTENV_CONFIG_PATH;
const isProduction = process.env.NODE_ENV === "production";

if (envPath) {
	dotenv.config({ path: resolveEnvPath(envPath), override: true });
} else {
	dotenv.config({ path: resolveEnvPath(".env") });
	if (!isProduction) {
		dotenv.config({ path: resolveEnvPath(".env.local"), override: true });
	}
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing Supabase URL or Key");
}

assertSecureRemoteUrl(supabaseUrl, "SUPABASE_URL");

let _supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export const getSupabase = (): SupabaseClient => _supabase;

export const setSupabaseClient = (client: SupabaseClient): void => {
	_supabase = client;
};
