import dotenv from "dotenv";

// Load .env file if it exists, otherwise use test defaults
dotenv.config();

// Set test environment variables if not already set
if (!process.env.SUPABASE_URL) {
	process.env.SUPABASE_URL = "https://test.supabase.co";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
	process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.CORS_ORIGIN) {
	process.env.CORS_ORIGIN = "http://localhost:5173";
}
if (!process.env.PORT) {
	process.env.PORT = "3000";
}
