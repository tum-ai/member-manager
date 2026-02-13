-- Add new profile fields to the members table for the enhanced member directory.
-- All new columns are nullable to maintain backward compatibility.

ALTER TABLE "public"."members"
    ADD COLUMN IF NOT EXISTS "batch" "text",
    ADD COLUMN IF NOT EXISTS "department" "text",
    ADD COLUMN IF NOT EXISTS "member_role" "text",
    ADD COLUMN IF NOT EXISTS "degree" "text",
    ADD COLUMN IF NOT EXISTS "school" "text",
    ADD COLUMN IF NOT EXISTS "skills" "text"[],
    ADD COLUMN IF NOT EXISTS "profile_picture_url" "text";

-- Add an RLS policy so all authenticated users can read all member rows.
-- This is needed for the member directory / member list feature.
-- Existing policies only allow users to read their own row (plus admin-only read-all).
CREATE POLICY "Authenticated users can view all members"
    ON "public"."members"
    FOR SELECT
    TO "authenticated"
    USING (true);
