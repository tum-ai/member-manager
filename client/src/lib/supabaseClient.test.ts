import { describe, expect, it } from "vitest";
import { getSupabaseConfigFromEnv } from "./supabaseClient";

const baseEnv = {
	PROD: false,
	VITE_SUPABASE_URL: "http://127.0.0.1:54321",
	VITE_SUPABASE_ANON_KEY: "test-anon-key",
};

describe("getSupabaseConfigFromEnv", () => {
	it("accepts local http Supabase URLs during development", () => {
		expect(getSupabaseConfigFromEnv(baseEnv)).toEqual({
			supabaseUrl: "http://127.0.0.1:54321",
			supabaseAnonKey: "test-anon-key",
		});
	});

	it("throws a helpful error when the Supabase URL is missing", () => {
		expect(() =>
			getSupabaseConfigFromEnv({
				...baseEnv,
				VITE_SUPABASE_URL: undefined,
			}),
		).toThrow("Missing VITE_SUPABASE_URL");
	});

	it("throws a helpful error when the Supabase URL is invalid", () => {
		expect(() =>
			getSupabaseConfigFromEnv({
				...baseEnv,
				VITE_SUPABASE_URL: "not-a-url",
			}),
		).toThrow("VITE_SUPABASE_URL must be a valid URL");
	});

	it("rejects insecure remote Supabase URLs in production", () => {
		expect(() =>
			getSupabaseConfigFromEnv({
				...baseEnv,
				PROD: true,
				VITE_SUPABASE_URL: "http://example.com",
			}),
		).toThrow("VITE_SUPABASE_URL must use HTTPS in production");
	});

	it("throws a helpful error when the anon key is missing", () => {
		expect(() =>
			getSupabaseConfigFromEnv({
				...baseEnv,
				VITE_SUPABASE_ANON_KEY: "   ",
			}),
		).toThrow("Missing VITE_SUPABASE_ANON_KEY");
	});
});
