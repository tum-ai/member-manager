-- Declare the 1:1 relationship between `sepa` and `members` so PostgREST
-- can auto-embed a member's SEPA row when selecting from `members`.
--
-- The admin directory route queries `.from("members").select("*, sepa(*)")`.
-- Without a declared foreign key, PostgREST fails with:
--   PGRST200: Could not find a relationship between 'members' and 'sepa'
--             in the schema cache
-- which bubbles up to the client as
--   500 {"error":"A database error occurred"}
--
-- Data shape already supports this: `members.user_id` is the PK and
-- `sepa.user_id` is UNIQUE, so one member maps to at most one SEPA row.
--
-- `not valid` so the migration does not fail if there are any legacy
-- orphan `sepa` rows whose `user_id` is missing from `members` (e.g. if a
-- SEPA row survived a member deletion before an ON DELETE CASCADE existed).
-- PostgREST only needs the constraint to exist to infer the relationship;
-- validation can be scheduled later with `alter ... validate constraint`.
alter table "public"."sepa"
    add constraint "sepa_user_id_members_fkey"
    foreign key ("user_id") references "public"."members"("user_id")
    on delete cascade
    not valid;
