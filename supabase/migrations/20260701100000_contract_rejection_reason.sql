begin;

-- Dedicated column for the reason a contract was rejected, so it is not
-- overloaded onto `feedback_message` (which is used for clarification inquiries).
alter table "public"."contract_submissions"
    add column if not exists "rejection_reason" text;

commit;
