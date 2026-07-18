begin;

-- Phase 3: department-scoped read access to finance data. A member whose
-- department is granted `finance.department` may read their own department's
-- budget (the app scopes analytics separately, server-side). Enforcement is
-- primarily in the app layer (service_role bypasses RLS); this predicate + the
-- extra SELECT policy are defense-in-depth for any direct authenticated reads.
create or replace function public.is_finance_department_member(
    target_department text
)
returns boolean
security definer
stable
language plpgsql
as $$
begin
  return exists (
    select 1
    from public.members m
    join public.department_permissions dp on dp.department = m.department
    where m.user_id = auth.uid()
      and m.active = true
      and m.department = target_department
      and dp.permissions ? 'finance.department'
  );
end;
$$;

-- Reviewers keep full management via the existing "Finance reviewers manage
-- budgets" policy. Add a read-only policy so a department member can SELECT
-- their own department's budget rows.
drop policy if exists "Department members read own budgets"
    on "public"."finance_budgets";
create policy "Department members read own budgets"
    on "public"."finance_budgets"
    as permissive
    for select
    to authenticated
    using (public.is_finance_department_member(department));

commit;
