begin;

-- Maps a BuchhaltungsButler second cost location (Kostenstelle 2) to a
-- human-readable spend category (e.g. Catering, Travel, Software). Like the
-- department mapping, the raw BB numbers are not self-describing, so the LnF
-- team labels them in-app. `cost_location_two` is stored normalized (leading
-- zeros stripped) to match how the postings pad inconsistently.
create table if not exists "public"."finance_category_mappings" (
    "id" uuid primary key default gen_random_uuid(),
    "cost_location_two" text not null unique,
    "label" text,
    "note" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

alter table "public"."finance_category_mappings" enable row level security;

-- Reuses is_finance_reviewer() from the department-mappings migration: caller is
-- admin or an active member of a department granted `finance.review`.
drop policy if exists "Finance reviewers manage category mappings"
    on "public"."finance_category_mappings";
create policy "Finance reviewers manage category mappings"
    on "public"."finance_category_mappings"
    as permissive
    for all
    to authenticated
    using (public.is_finance_reviewer())
    with check (public.is_finance_reviewer());

revoke all on table "public"."finance_category_mappings" from "anon";
grant select, insert, update, delete
    on table "public"."finance_category_mappings" to "authenticated";
grant all on table "public"."finance_category_mappings" to "service_role";

commit;
