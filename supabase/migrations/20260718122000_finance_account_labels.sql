begin;

-- Maps a BuchhaltungsButler ledger account number (SKR03 P&L account, e.g. 6810
-- Aufwand, 8450 Erlös) to a human-readable label. The account number is the
-- canonical key and stays meaningful on its own; the label is decoration the
-- LnF team maintains in-app so the accounts breakdown reads in plain language.
create table if not exists "public"."finance_account_labels" (
    "id" uuid primary key default gen_random_uuid(),
    "account" text not null unique,
    "label" text,
    "note" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

alter table "public"."finance_account_labels" enable row level security;

-- Reuses is_finance_reviewer() from the department-mappings migration: caller is
-- admin or an active member of a department granted `finance.review`.
drop policy if exists "Finance reviewers manage account labels"
    on "public"."finance_account_labels";
create policy "Finance reviewers manage account labels"
    on "public"."finance_account_labels"
    as permissive
    for all
    to authenticated
    using (public.is_finance_reviewer())
    with check (public.is_finance_reviewer());

revoke all on table "public"."finance_account_labels" from "anon";
grant select, insert, update, delete
    on table "public"."finance_account_labels" to "authenticated";
grant all on table "public"."finance_account_labels" to "service_role";

commit;
