begin;

alter table "public"."contract_submissions"
    add column if not exists "partner_email_sent_at" timestamptz,
    add column if not exists "partner_email_recipient" text,
    add column if not exists "partner_email_error" text;

commit;
