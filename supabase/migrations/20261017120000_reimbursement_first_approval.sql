-- Two-step reimbursement approval.
--
-- A reviewer's first "Approve" now only records a first approval; a second
-- "Approve" makes the request `approved` exactly as before. The first step
-- lives in its own columns so `approval_status` keeps its meaning: a request
-- with a first approval is still `pending` for every filter, the payment step
-- and the BuchhaltungsButler sync until the final approval.

alter table "public"."reimbursements"
    add column if not exists "first_approved_at" timestamptz,
    add column if not exists "first_approved_by" uuid
        references "auth"."users" ("id") on delete set null;

comment on column "public"."reimbursements"."first_approved_at" is
    'When a reviewer gave the first of the two approvals; null until then.';
comment on column "public"."reimbursements"."first_approved_by" is
    'Reviewer who gave the first approval.';
