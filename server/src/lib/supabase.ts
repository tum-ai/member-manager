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

// `pnpm dev` should use `.env`; `pnpm dev:local` opts into `.env.local`
// through DOTENV_CONFIG_PATH so local and hosted setups do not get mixed.
const envPath = process.env.DOTENV_CONFIG_PATH;

if (envPath) {
	dotenv.config({ path: resolveEnvPath(envPath), override: true });
} else {
	dotenv.config({ path: resolveEnvPath(".env") });
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
