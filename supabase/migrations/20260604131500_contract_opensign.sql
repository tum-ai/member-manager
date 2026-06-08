begin;

alter table "public"."contract_submissions"
    add column if not exists "signature_provider" text not null default 'in_app',
    add column if not exists "opensign_document_id" text,
    add column if not exists "opensign_status" text,
    add column if not exists "opensign_sent_at" timestamptz,
    add column if not exists "opensign_completed_at" timestamptz,
    add column if not exists "opensign_file_url" text,
    add column if not exists "opensign_certificate_url" text,
    add column if not exists "opensign_error" text,
    add column if not exists "opensign_webhook_last_event" text,
    add column if not exists "opensign_webhook_received_at" timestamptz,
    add constraint "contract_submissions_signature_provider_check"
        check ("signature_provider" in ('in_app', 'opensign'));

create unique index if not exists "contract_submissions_opensign_document_id_idx"
    on "public"."contract_submissions" ("opensign_document_id")
    where "opensign_document_id" is not null;

commit;
