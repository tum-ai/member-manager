import "@testing-library/jest-dom";

// Set up environment variables for tests
if (!import.meta.env.VITE_SUPABASE_URL) {
	import.meta.env.VITE_SUPABASE_URL = "https://test.supabase.co";
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
	import.meta.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
}
