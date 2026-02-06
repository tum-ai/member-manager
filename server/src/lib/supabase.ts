import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Support custom .env file path via DOTENV_CONFIG_PATH for local development
const envPath = process.env.DOTENV_CONFIG_PATH;
dotenv.config(envPath ? { path: envPath } : undefined);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error("Missing Supabase URL or Key");
}

let _supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export const getSupabase = (): SupabaseClient => _supabase;

export const setSupabaseClient = (client: SupabaseClient): void => {
	_supabase = client;
};

export const supabase = _supabase;
