begin;

-- Per-department budget ceilings for a fiscal period. The period is either a
-- calendar year ("2026") or a TUM.ai semester ("WS26" / "SS26"); the app maps
-- the period to a civil date range when comparing against actual postings. LnF
-- (finance reviewers) set and read budgets; department-scoped read access is
-- introduced in a later phase.
create table if not exists "public"."finance_budgets" (
    "id" uuid primary key default gen_random_uuid(),
    "department" text not null,
    "period_type" text not null check ("period_type" in ('year', 'semester')),
    "period_key" text not null,
    "amount_planned" numeric not null default 0 check ("amount_planned" >= 0),
    "currency" text not null default 'EUR',
    "note" text,
    "set_by" uuid,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    unique ("department", "period_type", "period_key")
);

alter table "public"."finance_budgets" enable row level security;

-- Reuses is_finance_reviewer() from the department-mappings migration: caller is
-- admin or an active member of a department granted `finance.review`.
drop policy if exists "Finance reviewers manage budgets"
    on "public"."finance_budgets";
create policy "Finance reviewers manage budgets"
    on "public"."finance_budgets"
    as permissive
    for all
    to authenticated
    using (public.is_finance_reviewer())
    with check (public.is_finance_reviewer());

revoke all on table "public"."finance_budgets" from "anon";
grant select, insert, update, delete
    on table "public"."finance_budgets" to "authenticated";
grant all on table "public"."finance_budgets" to "service_role";

commit;
