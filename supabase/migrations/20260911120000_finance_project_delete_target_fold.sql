-- Deleting a finance project must not be able to collide with itself.
--
-- Every foreign key pointing at `finance_projects` is ON DELETE SET NULL, so a
-- delete *detaches* rather than destroys: allocations and Planposten fall back
-- to the department bucket they came from, sub-projects become top-level, and
-- only the template assignments cascade away. Two of the detached tables carry
-- a UNIQUE ... NULLS NOT DISTINCT target index that includes `project_id`:
--
--   * finance_posting_allocations_target_idx
--         (posting_external_id, department, project_id, tax_area)
--   * finance_reallocation_request_items_target_idx
--         (request_id, department, project_id, tax_area)
--
-- A perfectly valid invoice can be split between a project and the *direct*
-- bucket of the same department with the same tax area. Those two rows differ
-- only in `project_id`, so the instant the foreign key sets the project-scoped
-- row's `project_id` to NULL both rows describe the same target, NULLS NOT
-- DISTINCT treats them as duplicates, and the DELETE fails with a unique
-- violation. The endpoint answered 500 instead of detaching the invoice.
--
-- `delete_finance_project` resolves those targets *before* the delete, in the
-- same transaction, by folding each project-scoped row into the surviving
-- department-level row of the same target:
--
--   * `allocated_amount` and `allocated_percentage` are summed into the
--     survivor. Both columns are fixed-scale numerics (14,2) and (7,4), so the
--     sum of two stored values is exact — no re-rounding and no re-apportioning
--     happens here. The posting therefore keeps exactly the total amount and
--     exactly the 100 % percentage sum that `replace_finance_posting_allocations`
--     wrote; only the number of rows carrying it shrinks.
--   * the notes are concatenated (de-duplicated) so neither side's explanation
--     is silently dropped.
--
-- The `department` of a project-scoped row is read as
-- `coalesce(department, <project department>)`. Every application write path
-- derives an allocation's department from its project (and
-- `finance_projects.department` is NOT NULL), so a row whose only non-null
-- target column is `project_id` is not reachable today — but the
-- `*_target_check` constraints ("at least one of department, project_id,
-- tax_area") are re-evaluated by the SET NULL update, so such a row would turn
-- the 500 into a check violation instead. Folding on the coalesced department
-- both groups those rows with the bucket they belong to and leaves them with a
-- non-null target, without a separate branch.
--
-- The other foreign keys need no fold: `finance_plan_items` is unique only on
-- the partial `(project_id, template_item_id)` index, which the row leaves
-- entirely once `project_id` is NULL, and `reimbursements.finance_project_id`
-- and `finance_projects.parent_project_id` carry no unique index at all.

begin;

create or replace function "public"."delete_finance_project"("p_id" uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_project public.finance_projects%rowtype;
    v_fold record;
begin
    -- Same dependency-first lock order as `update_finance_project`, so the two
    -- project writers serialise instead of inverting each other's locks.
    lock table public.finance_project_template_assignments
        in share row exclusive mode;
    lock table public.finance_plan_items
        in share row exclusive mode;
    lock table public.finance_posting_allocations
        in share row exclusive mode;
    lock table public.finance_reallocation_request_items
        in share row exclusive mode;
    lock table public.reimbursements
        in share row exclusive mode;
    lock table public.finance_projects
        in share row exclusive mode;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('finance-project:' || p_id::text, 0)
    );

    select *
    into v_project
    from public.finance_projects
    where id = p_id
    for update;

    if not found then
        raise exception 'Finance project not found';
    end if;

    -- Posting allocations: the post-delete target is
    -- (posting_external_id, department, NULL, tax_area).
    for v_fold in
        select
            a.posting_external_id,
            coalesce(a.department, v_project.department) as department,
            a.tax_area,
            sum(a.allocated_amount) as allocated_amount,
            sum(a.allocated_percentage) as allocated_percentage,
            string_agg(
                distinct nullif(btrim(a.note), ''),
                ' | '
                order by nullif(btrim(a.note), '')
            ) as note,
            (array_agg(a.id order by a.created_at, a.id))[1] as keep_id
        from public.finance_posting_allocations a
        where a.project_id = p_id
        group by
            a.posting_external_id,
            coalesce(a.department, v_project.department),
            a.tax_area
    loop
        update public.finance_posting_allocations s
        set
            allocated_amount = s.allocated_amount + v_fold.allocated_amount,
            allocated_percentage =
                s.allocated_percentage + v_fold.allocated_percentage,
            note = nullif(
                concat_ws(' | ', nullif(btrim(s.note), ''), v_fold.note),
                ''
            ),
            updated_at = now()
        where s.posting_external_id = v_fold.posting_external_id
            and s.department is not distinct from v_fold.department
            and s.project_id is null
            and s.tax_area is not distinct from v_fold.tax_area;

        if found then
            delete from public.finance_posting_allocations a
            where a.project_id = p_id
                and a.posting_external_id = v_fold.posting_external_id
                and coalesce(a.department, v_project.department)
                    is not distinct from v_fold.department
                and a.tax_area is not distinct from v_fold.tax_area;
        else
            -- Nothing owns the post-delete target yet, so the project's own
            -- oldest row becomes the department-level row. The duplicates go
            -- first: the surviving row's department is rewritten below, and with
            -- `project_id` still set that write would otherwise collide with the
            -- very rows it is absorbing.
            delete from public.finance_posting_allocations a
            where a.project_id = p_id
                and a.id <> v_fold.keep_id
                and a.posting_external_id = v_fold.posting_external_id
                and coalesce(a.department, v_project.department)
                    is not distinct from v_fold.department
                and a.tax_area is not distinct from v_fold.tax_area;

            update public.finance_posting_allocations a
            set
                department = v_fold.department,
                allocated_amount = v_fold.allocated_amount,
                allocated_percentage = v_fold.allocated_percentage,
                note = v_fold.note,
                updated_at = now()
            where a.id = v_fold.keep_id;
        end if;
    end loop;

    -- Reallocation request items: same fold, keyed by request instead of
    -- posting, because that is what their target index is keyed by.
    for v_fold in
        select
            i.request_id,
            coalesce(i.department, v_project.department) as department,
            i.tax_area,
            sum(i.allocated_amount) as allocated_amount,
            sum(i.allocated_percentage) as allocated_percentage,
            string_agg(
                distinct nullif(btrim(i.note), ''),
                ' | '
                order by nullif(btrim(i.note), '')
            ) as note,
            (array_agg(i.id order by i.created_at, i.id))[1] as keep_id
        from public.finance_reallocation_request_items i
        where i.project_id = p_id
        group by
            i.request_id,
            coalesce(i.department, v_project.department),
            i.tax_area
    loop
        update public.finance_reallocation_request_items s
        set
            allocated_amount = s.allocated_amount + v_fold.allocated_amount,
            allocated_percentage =
                s.allocated_percentage + v_fold.allocated_percentage,
            note = nullif(
                concat_ws(' | ', nullif(btrim(s.note), ''), v_fold.note),
                ''
            ),
            updated_at = now()
        where s.request_id = v_fold.request_id
            and s.department is not distinct from v_fold.department
            and s.project_id is null
            and s.tax_area is not distinct from v_fold.tax_area;

        if found then
            delete from public.finance_reallocation_request_items i
            where i.project_id = p_id
                and i.request_id = v_fold.request_id
                and coalesce(i.department, v_project.department)
                    is not distinct from v_fold.department
                and i.tax_area is not distinct from v_fold.tax_area;
        else
            delete from public.finance_reallocation_request_items i
            where i.project_id = p_id
                and i.id <> v_fold.keep_id
                and i.request_id = v_fold.request_id
                and coalesce(i.department, v_project.department)
                    is not distinct from v_fold.department
                and i.tax_area is not distinct from v_fold.tax_area;

            update public.finance_reallocation_request_items i
            set
                department = v_fold.department,
                allocated_amount = v_fold.allocated_amount,
                allocated_percentage = v_fold.allocated_percentage,
                note = v_fold.note,
                updated_at = now()
            where i.id = v_fold.keep_id;
        end if;
    end loop;

    -- Every remaining reference detaches through its own ON DELETE SET NULL,
    -- exactly as before.
    delete from public.finance_projects
    where id = p_id;
end;
$$;

revoke all
on function "public"."delete_finance_project"(uuid)
from public, anon, authenticated, service_role;
grant execute
on function "public"."delete_finance_project"(uuid)
to service_role;

commit;
