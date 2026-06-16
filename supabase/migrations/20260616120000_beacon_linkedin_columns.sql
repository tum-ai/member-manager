-- Formalize the LinkedIn enrichment columns that exist in PRODUCTION's
-- `members` table but were never captured in a committed migration (they were
-- added out-of-band). Without this, a plain `supabase db reset` produces a
-- local schema missing these columns, and the Beacon data pull has to add them
-- ad hoc. Declaring them here keeps local and remote schemas in parity.
--
-- Both are nullable: existing rows are unaffected and no backfill is required.
-- `linkedin_profile_url` / `public_location` already have their own migration
-- (20260519210000); these two are the remaining drift.

alter table "public"."members"
    add column if not exists "linkedin_id" text,  -- stable LinkedIn member id
    add column if not exists "linkedin_url" text; -- canonical LinkedIn profile URL
