begin;

-- Bottom-up plan line items a department drafts within its budget for a fiscal
-- period. Reviewers (LnF/admin) manage any department's items; a member whose
-- department grants `finance.department` manages only their own department's.
create table if not exists "public"."finance_plan_items" (
    "id" uuid primary key default gen_random_uuid(),
    "department" text not null,
    "period_type" text not null check ("period_type" in ('year', 'semester')),
    "period_key" text not null,
    "label" text not null,
    "category" text,
    "planned_amount" numeric not null default 0 check ("planned_amount" >= 0),
    "expected_month" text,
    "status" text not null default 'planned'
        check ("status" in ('planned', 'committed', 'spent')),
    "note" text,
    "created_by" uuid,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

create index if not exists "finance_plan_items_period_idx"
    on "public"."finance_plan_items" ("period_type", "period_key", "department");

alter table "public"."finance_plan_items" enable row level security;

-- Reviewers manage everything; department members manage their own department's
-- items (is_finance_department_member from the department-access migration).
drop policy if exists "Finance reviewers manage plan items"
    on "public"."finance_plan_items";
create policy "Finance reviewers manage plan items"
    on "public"."finance_plan_items"
    as permissive
    for all
    to authenticated
    using (public.is_finance_reviewer())
    with check (public.is_finance_reviewer());

drop policy if exists "Department members manage own plan items"
    on "public"."finance_plan_items";
create policy "Department members manage own plan items"
    on "public"."finance_plan_items"
    as permissive
    for all
    to authenticated
    using (public.is_finance_department_member(department))
    with check (public.is_finance_department_member(department));

revoke all on table "public"."finance_plan_items" from "anon";
grant select, insert, update, delete
    on table "public"."finance_plan_items" to "authenticated";
grant all on table "public"."finance_plan_items" to "service_role";

commit;
