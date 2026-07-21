begin;

-- Maps a BuchhaltungsButler cost location (Kostenstelle) to a TUM.ai department
-- and steuerlicher Bereich. The LnF team maintains this mapping in-app; the BB
-- numbers (e.g. 051, 082) are not self-describing, so the assignment must be
-- captured explicitly. `cost_location` is stored normalized (leading zeros
-- stripped) because the raw postings pad inconsistently (both "82" and "082").
create table if not exists "public"."finance_department_mappings" (
    "id" uuid primary key default gen_random_uuid(),
    "cost_location" text not null unique,
    "department" text,
    "bereich" text check ("bereich" in ('ideell', 'wirtschaftlich', 'zweckbetrieb')),
    "note" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

alter table "public"."finance_department_mappings" enable row level security;

-- Caller is admin or an active member of a department granted `finance.review`
-- (the LnF team). Mirrors is_tumai_days_manager() so it stays consistent when
-- admins reassign the permission rather than hardcoding a department.
create or replace function public.is_finance_reviewer()
returns boolean
security definer
stable
language plpgsql
set search_path = ''
as $$
begin
  return (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    ) or
    exists (
      select 1
      from public.members m
      join public.department_permissions dp on dp.department = m.department
      where m.user_id = auth.uid()
        and m.active = true
        and dp.permissions ? 'finance.review'
    )
  );
end;
$$;

drop policy if exists "Finance reviewers manage department mappings"
    on "public"."finance_department_mappings";
create policy "Finance reviewers manage department mappings"
    on "public"."finance_department_mappings"
    as permissive
    for all
    to authenticated
    using (public.is_finance_reviewer())
    with check (public.is_finance_reviewer());

revoke all on table "public"."finance_department_mappings"
    from "anon", "authenticated";
grant select, insert, update, delete
    on table "public"."finance_department_mappings" to "authenticated";
grant all on table "public"."finance_department_mappings" to "service_role";

commit;
