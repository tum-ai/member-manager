-- Add expertise fields to the members table for the expertise graph + Q&A feature.
-- These are professional/public profile fields (not sensitive like IBAN/address/
-- DOB/phone), so they are stored as plaintext and require no encryption. Both are
-- backfill-later: existing rows are unaffected and no data migration is required.

ALTER TABLE "public"."members"
    ADD COLUMN IF NOT EXISTS "expertise_summary" text, -- short human phrase, e.g. "Applied ML research: NLP and computer vision"
    ADD COLUMN IF NOT EXISTS "expertise_tags" text[] NOT NULL DEFAULT '{}'; -- lowercase, hyphenated tags, e.g. {"machine-learning","nlp"}
