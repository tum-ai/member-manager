-- Department-level Planposten survive a posting being filed into a project.
--
-- `replace_finance_posting_allocations` protected an existing plan-item match by
-- comparing the matched amount against the allocations at the *exact*
-- `(department, project_id)` scope of the plan item. A department-level
-- Planposten has `project_id is null`, so assigning its matched invoice to any
-- project of the same department dropped its capacity to zero and the guard
-- refused the write — even though the invoice never left the department. That
-- made FR-L7 ("only a Planposten of *another project* blocks the move")
-- unreachable and reported the refusal as `matched_elsewhere` with no other
-- project involved.
--
-- Only the capacity rule of this function changes; every other refusal is
-- unchanged. `create_finance_plan_item_posting_match` stays strict on purpose:
-- preserving a match while the money stays inside its department creates no new
-- claim, whereas letting a *new* department-level match be booked against money
-- already allocated to a project would let the same euro be claimed at two
-- levels of the same tree.

create or replace function "public"."replace_finance_posting_allocations"(
    "p_posting_external_id" text,
    "p_allocations" jsonb,
    "p_actor" uuid,
    "p_posting_amount" numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_percentage numeric;
    v_posting_cents bigint;
    v_canonical_allocations jsonb;
    v_rows jsonb;
begin
    if p_posting_external_id is null
        or btrim(p_posting_external_id) = '' then
        raise exception 'Posting external id is required';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'finance-posting:' || p_posting_external_id,
            0
        )
    );

    if p_allocations is null
        or jsonb_typeof(p_allocations) <> 'array'
        or jsonb_array_length(p_allocations) = 0 then
        raise exception 'At least one posting allocation is required';
    end if;

    if p_posting_amount is null or p_posting_amount = 0 then
        raise exception 'Posting amount is required and cannot be zero';
    end if;

    select sum((entry ->> 'allocated_percentage')::numeric)
    into v_percentage
    from jsonb_array_elements(p_allocations) as entries(entry);

    if abs(coalesce(v_percentage, 0) - 100) > 0.01 then
        raise exception 'Posting allocation percentages must total 100';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_allocations) as entries(entry)
        group by
            nullif(entry ->> 'department', ''),
            nullif(entry ->> 'project_id', '')::uuid,
            nullif(entry ->> 'tax_area', '')
        having count(*) > 1
    ) then
        raise exception 'Posting allocation targets must be unique';
    end if;

    v_posting_cents := floor(p_posting_amount * 100 + 0.5)::bigint;

    with ordered_allocations as (
        select
            entry,
            row_number() over (
                order by
                    coalesce(nullif(entry ->> 'department', ''), '')
                        collate "C",
                    coalesce(nullif(entry ->> 'project_id', ''), '')
                        collate "C",
                    coalesce(nullif(entry ->> 'tax_area', ''), '')
                        collate "C"
            ) as allocation_order,
            count(*) over () as allocation_count
        from jsonb_array_elements(p_allocations) as entries(entry)
    ),
    rounded_allocations as (
        select
            ordered_allocations.*,
            case
                when allocation_order < allocation_count then
                    floor(
                        v_posting_cents
                        * (entry ->> 'allocated_percentage')::numeric
                        / 100
                        + 0.5
                    )::bigint
                else null
            end as rounded_cents
        from ordered_allocations
    ),
    apportioned_allocations as (
        select
            rounded_allocations.*,
            case
                when allocation_order = allocation_count then
                    v_posting_cents
                    - coalesce(sum(rounded_cents) over (), 0)
                else rounded_cents
            end as allocated_cents
        from rounded_allocations
    )
    select coalesce(
        jsonb_agg(
            (entry - 'allocated_amount')
                || jsonb_build_object(
                    'allocated_amount',
                    allocated_cents::numeric / 100
                )
            order by allocation_order
        ),
        '[]'::jsonb
    )
    into v_canonical_allocations
    from apportioned_allocations;

    if exists (
        select 1
        from (
            select
                pi.department,
                pi.project_id,
                sum(m.matched_amount) as matched_amount
            from public.finance_plan_item_posting_matches m
            join public.finance_plan_items pi on pi.id = m.plan_item_id
            where m.posting_external_id = p_posting_external_id
            group by pi.department, pi.project_id
        ) matched_scope
        where matched_scope.matched_amount > (
            select coalesce(
                sum(abs((entry ->> 'allocated_amount')::numeric)),
                0
            )
            from jsonb_array_elements(v_canonical_allocations)
                as entries(entry)
            where nullif(entry ->> 'department', '')
                    is not distinct from matched_scope.department
                and (
                    -- A department-level Planposten (no project) is funded by
                    -- any allocation of that department, including one that
                    -- files the posting into a project *inside* the department:
                    -- the money never leaves the department, so the match stays
                    -- valid (FR-L7). Only a project-scoped Planposten needs its
                    -- own project to keep carrying the amount.
                    matched_scope.project_id is null
                    or nullif(entry ->> 'project_id', '')::uuid
                        is not distinct from matched_scope.project_id
                )
        )
    ) then
        raise exception
            'Posting allocations cannot invalidate existing plan item matches';
    end if;

    delete from public.finance_posting_allocations
    where posting_external_id = p_posting_external_id;

    insert into public.finance_posting_allocations (
        posting_external_id,
        department,
        project_id,
        tax_area,
        allocated_amount,
        allocated_percentage,
        note,
        created_by
    )
    select
        p_posting_external_id,
        nullif(entry ->> 'department', ''),
        nullif(entry ->> 'project_id', '')::uuid,
        nullif(entry ->> 'tax_area', ''),
        (entry ->> 'allocated_amount')::numeric,
        (entry ->> 'allocated_percentage')::numeric,
        nullif(entry ->> 'note', ''),
        p_actor
    from jsonb_array_elements(v_canonical_allocations) as entries(entry);

    select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    into v_rows
    from public.finance_posting_allocations a
    where a.posting_external_id = p_posting_external_id;

    return v_rows;
end;
$$;

revoke all
on function "public"."replace_finance_posting_allocations"(
    text,
    jsonb,
    uuid,
    numeric
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."replace_finance_posting_allocations"(
    text,
    jsonb,
    uuid,
    numeric
)
to service_role;
