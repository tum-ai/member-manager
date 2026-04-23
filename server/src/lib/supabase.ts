import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { loadEnvChain } from "./loadEnv.js";
import { assertSecureRemoteUrl } from "./sensitiveData.js";

// Env loading convention (matches Vite's):
//   1. `.env`           - committed hosted-project defaults
//   2. `.env.local`     - gitignored local-dev overrides, applied on top
//   3. DOTENV_CONFIG_PATH - if set, replaces the chain entirely
//
// This ensures `pnpm dev` against a locally-running Supabase stack still
// picks up the generated `.env.local` (from `pnpm setup:local`) instead of
// silently validating JWTs against a stale hosted project and returning
// "Invalid token" for locally-issued access tokens.
loadEnvChain({ explicitPath: process.env.DOTENV_CONFIG_PATH });

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
