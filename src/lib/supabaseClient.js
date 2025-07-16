import { createClient } from '@supabase/supabase-js';

// Access environment variables based on your build tool.
// For Vite, use import.meta.env
// For Create React App, use process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- DEBUGGING STEP: Check if env variables are loaded ---
console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Anon Key:", supabaseAnonKey);
// --- END DEBUGGING STEP ---

// Ensure that the environment variables are actually loaded.
// You might want to add a check or a console.log during development
// to ensure these variables are not undefined.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Please check your .env file and environment variable names.");
  // You could throw an error here to prevent the app from running with misconfigured keys
  // throw new Error("Supabase credentials not configured.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);