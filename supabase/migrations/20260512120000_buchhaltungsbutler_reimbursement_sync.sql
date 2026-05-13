begin;

alter table "public"."reimbursements"
    add column if not exists "bb_sync_status" text not null default 'not_synced',
    add column if not exists "bb_receipt_id_by_customer" text,
    add column if not exists "bb_receipt_filename" text,
    add column if not exists "bb_synced_at" timestamptz,
    add column if not exists "bb_sync_error" text,
    add column if not exists "bb_sync_attempts" integer not null default 0,
    add column if not exists "bb_last_sync_attempt_at" timestamptz,
    add column if not exists "bb_synced_by" uuid references "public"."members"("user_id") on delete set null;

alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_bb_sync_status_check";

alter table "public"."reimbursements"
    add constraint "reimbursements_bb_sync_status_check"
    check ("bb_sync_status" in ('not_synced', 'pending', 'synced', 'failed'));

create index if not exists "reimbursements_bb_sync_status_idx"
    on "public"."reimbursements" ("bb_sync_status");

commit;
