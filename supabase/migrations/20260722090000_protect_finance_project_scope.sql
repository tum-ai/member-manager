begin;

create or replace function "public"."update_finance_project"(
    "p_id" uuid,
    "p_parent_project_id" uuid,
    "p_name" text,
    "p_department" text,
    "p_period_type" text,
    "p_period_key" text,
    "p_tax_area" text,
    "p_target_amount" numeric,
    "p_status" text,
    "p_description" text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_project public.finance_projects%rowtype;
    v_parent public.finance_projects%rowtype;
    v_updated public.finance_projects%rowtype;
    v_scope_changed boolean;
    v_would_cycle boolean;
begin
    -- Dependency-first ordering lets in-flight writers finish before this RPC
    -- blocks new writes, avoiding foreign-key lock inversions with projects.
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

    perform pg_advisory_xact_lock(
        hashtextextended('finance-project:' || p_id::text, 0)
    );

    select *
    into v_project
    from public.finance_projects
    where id = p_id
    for update;

    if not found then
        raise exception 'Finance project not found';
    end if;

    if p_parent_project_id is not null then
        select *
        into v_parent
        from public.finance_projects
        where id = p_parent_project_id;

        if not found then
            raise exception 'Parent finance project not found';
        end if;

        if v_parent.department is distinct from p_department
            or v_parent.period_type is distinct from p_period_type
            or v_parent.period_key is distinct from p_period_key
        then
            raise exception
                'Parent project must use the same department and period';
        end if;

        with recursive parent_chain as (
            select
                parent.id,
                parent.parent_project_id,
                array[parent.id]::uuid[] as path,
                parent.id = p_id as is_cycle
            from public.finance_projects parent
            where parent.id = p_parent_project_id

            union all

            select
                parent.id,
                parent.parent_project_id,
                chain.path || parent.id,
                parent.id = p_id or parent.id = any(chain.path)
            from public.finance_projects parent
            join parent_chain chain
                on parent.id = chain.parent_project_id
            where not chain.is_cycle
        )
        select exists (
            select 1
            from parent_chain
            where is_cycle
        )
        into v_would_cycle;

        if v_would_cycle then
            raise exception 'Project hierarchy cannot contain a cycle';
        end if;
    end if;

    v_scope_changed :=
        v_project.department is distinct from p_department
        or v_project.period_type is distinct from p_period_type
        or v_project.period_key is distinct from p_period_key;

    if v_scope_changed and (
        exists (
            select 1
            from public.finance_projects
            where parent_project_id = p_id
        )
        or exists (
            select 1
            from public.finance_plan_items
            where project_id = p_id
        )
        or exists (
            select 1
            from public.finance_posting_allocations
            where project_id = p_id
        )
        or exists (
            select 1
            from public.finance_reallocation_request_items
            where project_id = p_id
        )
        or exists (
            select 1
            from public.finance_project_template_assignments
            where project_id = p_id
        )
        or exists (
            select 1
            from public.reimbursements
            where finance_project_id = p_id
        )
    ) then
        raise exception
            'Project department or period cannot change while dependent finance records exist';
    end if;

    update public.finance_projects
    set
        parent_project_id = p_parent_project_id,
        name = p_name,
        department = p_department,
        period_type = p_period_type,
        period_key = p_period_key,
        tax_area = p_tax_area,
        target_amount = p_target_amount,
        status = p_status,
        description = p_description,
        updated_at = now()
    where id = p_id
    returning * into v_updated;

    return to_jsonb(v_updated);
end;
$$;

revoke all
on function "public"."update_finance_project"(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    numeric,
    text,
    text
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."update_finance_project"(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    numeric,
    text,
    text
)
to service_role;

commit;
