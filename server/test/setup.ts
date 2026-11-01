import dotenv from "dotenv";
import { setAllowNonSlackUsers } from "../src/lib/slackWorkspace.js";

// Load .env file if it exists, otherwise use test defaults
dotenv.config();

// Set test environment variables if not already set
if (!process.env.SUPABASE_URL) {
	process.env.SUPABASE_URL = "https://test.supabase.co";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
	process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.FIELD_ENCRYPTION_KEY) {
	process.env.FIELD_ENCRYPTION_KEY =
		"test-field-encryption-key-with-at-least-32-characters";
}
if (!process.env.CORS_ORIGIN) {
	process.env.CORS_ORIGIN = "http://localhost:5173";
}
if (!process.env.PORT) {
	process.env.PORT = "8787";
}

// Tests run the production workspace rule (Slack identity required) even
// when a developer's server/.env.local points SUPABASE_URL at a local stack.
setAllowNonSlackUsers(false);
