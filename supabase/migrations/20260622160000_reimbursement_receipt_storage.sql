begin;

-- Reimbursement receipts live in private Supabase Storage so uploads/downloads
-- bypass Vercel's 4.5 MB function payload limit. Access remains server-mediated
-- via signed upload/download URLs.
insert into "storage"."buckets" (
    "id", "name", "public", "file_size_limit", "allowed_mime_types"
)
values (
    'reimbursement-receipts',
    'reimbursement-receipts',
    false,
    10485760, -- 10 MiB
    array['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
on conflict ("id") do update set
    "public" = excluded."public",
    "file_size_limit" = excluded."file_size_limit",
    "allowed_mime_types" = excluded."allowed_mime_types";

-- Existing rows keep their inline receipt_base64 payloads. New rows may instead
-- reference an object in the private bucket.
alter table "public"."reimbursements"
    add column if not exists "receipt_storage_bucket" text,
    add column if not exists "receipt_storage_path" text,
    add column if not exists "receipt_size_bytes" integer;

alter table "public"."reimbursements"
    alter column "receipt_base64" drop not null;

alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_receipt_payload_check";

alter table "public"."reimbursements"
    add constraint "reimbursements_receipt_payload_check"
    check ("receipt_base64" is not null or "receipt_storage_path" is not null)
    not valid;

alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_receipt_storage_pair_check";

alter table "public"."reimbursements"
    add constraint "reimbursements_receipt_storage_pair_check"
    check (
        (
            "receipt_storage_path" is null
            and "receipt_storage_bucket" is null
        )
        or (
            "receipt_storage_path" is not null
            and coalesce("receipt_storage_bucket", '') <> ''
        )
    )
    not valid;

alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_receipt_size_bytes_check";

alter table "public"."reimbursements"
    add constraint "reimbursements_receipt_size_bytes_check"
    check (
        "receipt_size_bytes" is null
        or ("receipt_size_bytes" > 0 and "receipt_size_bytes" <= 10485760)
    )
    not valid;

create unique index if not exists "reimbursements_receipt_storage_path_idx"
    on "public"."reimbursements" ("receipt_storage_bucket", "receipt_storage_path")
    where "receipt_storage_path" is not null;

commit;
