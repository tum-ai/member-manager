import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { loadEnvChain } from "./loadEnv.js";
import { assertSecureRemoteUrl } from "./sensitiveData.js";

// Env loading convention (matches Vite's):
//   1. `.env`           - committed hosted-project defaults
//   2. `.env.local`     - gitignored local-dev overrides, applied on top
//   3. DOTENV_CONFIG_PATH - if set, replaces the chain entirely
//
// The local dev script intentionally uses the default chain so optional
// developer secrets can live in `.env` while generated Supabase values live in
// `.env.local`.
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
