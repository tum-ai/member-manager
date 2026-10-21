-- Edit and resubmit a rejected reimbursement.
--
-- A member can fix a rejected request and send the same row back to review
-- instead of filing a new one. Resubmitting clears `rejection_reason` (the
-- request is no longer rejected), so the reason the member addressed moves to
-- `last_rejection_reason` for reviewers to compare against.

-- The check is declared on the column so `if not exists` guards it too.
alter table "public"."reimbursements"
    add column if not exists "resubmission_count" integer not null default 0
        constraint "reimbursements_resubmission_count_check"
            check ("resubmission_count" >= 0),
    add column if not exists "resubmitted_at" timestamptz,
    add column if not exists "last_rejection_reason" text;

comment on column "public"."reimbursements"."resubmission_count" is
    'How often the requester edited and resubmitted this request after a rejection.';
comment on column "public"."reimbursements"."resubmitted_at" is
    'When the requester last resubmitted this request; null if never.';
comment on column "public"."reimbursements"."last_rejection_reason" is
    'Rejection reason in force when the request was last resubmitted.';
