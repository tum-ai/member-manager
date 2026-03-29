-- These helper functions accept caller-provided encryption keys.
-- The application now performs field encryption on the server before data
-- reaches Supabase, so public RPC access is no longer needed.

REVOKE ALL ON FUNCTION "public"."decrypt_iban_db"("encrypted_iban" "bytea", "encryption_key" "text")
FROM "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."decrypt_ibans_batch_db"("encrypted_ibans" "bytea"[], "encryption_key" "text")
FROM "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."encrypt_iban_db"("iban_to_encrypt" "text", "encryption_key" "text")
FROM "anon", "authenticated";
