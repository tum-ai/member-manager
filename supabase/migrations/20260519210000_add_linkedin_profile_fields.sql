-- Add LinkedIn-enriched profile fields to the members table.
-- All columns are nullable: existing rows are unaffected and no backfill
-- is required by the migration itself.

ALTER TABLE "public"."members"
    ADD COLUMN IF NOT EXISTS "linkedin_id"       text,   -- e.g. "donikamorina"
    ADD COLUMN IF NOT EXISTS "linkedin_url"      text,   -- full profile URL
    ADD COLUMN IF NOT EXISTS "location"          text,   -- current city / region
    ADD COLUMN IF NOT EXISTS "current_company"   text,   -- latest employer
    ADD COLUMN IF NOT EXISTS "education"         text;   -- comma-separated universities
