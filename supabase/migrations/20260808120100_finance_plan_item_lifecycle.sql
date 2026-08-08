-- T-Konto workbench, FR-M + FR-N5: Planposten become live objects inside the
-- T-view instead of rows in a separate planning tab.
--
--   * `is_active`  — enable/disable a Planposten (FR-M3). A disabled item stays
--                    visible but is excluded from every plan total, and cannot
--                    receive new matches (FR-M8).
--   * `vat_rate`   — planned VAT so the forecast Zahllast is meaningful (FR-N5).
--   * `project_id` — the column already exists; only the write path ignored it,
--                    so a Planposten could never be created inside a project.
--                    `update_finance_plan_item` gains it here (FR-M1/M2).
--
-- Matching a posting also drives the status forward (FR-M4) and detaching the
-- last match walks it back (FR-M7). The automation only ever moves the status
-- *forward*, so a manual override to a later state is never undone by a
-- subsequent partial match.

begin;

alter table "public"."finance_plan_items"
    add column if not exists "is_active" boolean not null default true,
    add column if not exists "vat_rate" numeric(5, 2)
        check ("vat_rate" is null or ("vat_rate" >= 0 and "vat_rate" <= 100));

-- The T-view lists active items inline and disabled ones behind a disclosure,
-- always within one department + period.
create index if not exists "finance_plan_items_active_idx"
on "public"."finance_plan_items"
    ("period_type", "period_key", "department", "is_active");

-- Rank the statuses so the match automation can move a Planposten forward only.
create or replace function "public"."finance_plan_status_rank"("p_status" text)
returns integer
language sql
immutable
set search_path = ''
as $$
    select case p_status
        when 'planned' then 0
        when 'committed' then 1
        when 'spent' then 2
        else 0
    end;
$$;

revoke all
on function "public"."finance_plan_status_rank"(text)
from public, anon, authenticated, service_role;
grant execute
on function "public"."finance_plan_status_rank"(text)
to service_role;

-- `update_finance_plan_item` gains p_project_id, p_is_active and p_vat_rate.
-- The old arity is dropped below so callers cannot resolve to it by accident.
create or replace function "public"."update_finance_plan_item"(
    "p_id" uuid,
    "p_label" text,
    "p_category" text,
    "p_direction" text,
    "p_planned_amount" numeric,
    "p_expected_month" text,
    "p_status" text,
    "p_note" text,
    "p_project_id" uuid,
    "p_is_active" boolean,
    "p_vat_rate" numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_plan_item public.finance_plan_items%rowtype;
    v_project public.finance_projects%rowtype;
    v_matched_amount numeric;
begin
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'finance-plan-item:' || p_id::text,
            0
        )
    );

    select *
    into v_plan_item
    from public.finance_plan_items
    where id = p_id
    for update;

    if not found then
        raise exception 'Finance plan item not found';
    end if;

    select coalesce(sum(matched_amount), 0)
    into v_matched_amount
    from public.finance_plan_item_posting_matches
    where plan_item_id = p_id;

    if v_matched_amount > p_planned_amount + 0.01 then
        raise exception
            'Plan item amount cannot be reduced below its matched total';
    end if;

    if v_matched_amount > 0
        and v_plan_item.direction
            <> coalesce(p_direction, v_plan_item.direction) then
        raise exception
            'Plan item direction cannot change while postings are matched';
    end if;

    -- Moving a matched Planposten to another project would strand its matches:
    -- a match is only valid while the posting is allocated to the item's
    -- project, and that allocation is not re-checked here (FR-L7 mirror).
    if v_matched_amount > 0
        and v_plan_item.project_id is distinct from p_project_id then
        raise exception
            'Plan item project cannot change while postings are matched';
    end if;

    if p_project_id is not null then
        select *
        into v_project
        from public.finance_projects
        where id = p_project_id;

        if not found then
            raise exception 'Finance project not found';
        end if;

        if v_project.department is distinct from v_plan_item.department
            or v_project.period_type is distinct from v_plan_item.period_type
            or v_project.period_key is distinct from v_plan_item.period_key
        then
            raise exception
                'Plan item project must use the same department and period';
        end if;
    end if;

    update public.finance_plan_items
    set
        label = p_label,
        category = p_category,
        direction = coalesce(p_direction, v_plan_item.direction),
        planned_amount = p_planned_amount,
        expected_month = p_expected_month,
        status = p_status,
        note = p_note,
        project_id = p_project_id,
        is_active = coalesce(p_is_active, v_plan_item.is_active),
        vat_rate = p_vat_rate,
        updated_at = now()
    where id = p_id
    returning * into v_plan_item;

    return to_jsonb(v_plan_item);
end;
$$;

revoke all
on function "public"."update_finance_plan_item"(
    uuid,
    text,
    text,
    text,
    numeric,
    text,
    text,
    text,
    uuid,
    boolean,
    numeric
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."update_finance_plan_item"(
    uuid,
    text,
    text,
    text,
    numeric,
    text,
    text,
    text,
    uuid,
    boolean,
    numeric
)
to service_role;

drop function if exists "public"."update_finance_plan_item"(
    uuid,
    text,
    text,
    text,
    numeric,
    text,
    text,
    text
);

-- Matching: reject an inactive Planposten (FR-M8) and drive the status forward
-- once money actually arrives (FR-M4). Everything else is unchanged from
-- 20260721212000_finance_planning_and_budget_transfers.sql.
create or replace function "public"."create_finance_plan_item_posting_match"(
    "p_id" uuid,
    "p_plan_item_id" uuid,
    "p_posting_external_id" text,
    "p_matched_amount" numeric,
    "p_match_type" text,
    "p_actor" uuid,
    "p_posting_amount" numeric,
    "p_posting_direction" text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_posting_lock bigint;
    v_plan_item_lock bigint;
    v_allocation_count bigint;
    v_posting_cents bigint;
    v_scope_allocated_cents bigint;
    v_effective_posting_capacity numeric;
    v_posting_matched numeric;
    v_plan_item_matched numeric;
    v_next_status text;
    v_plan_item public.finance_plan_items%rowtype;
    v_match public.finance_plan_item_posting_matches%rowtype;
begin
    if p_id is null
        or p_plan_item_id is null
        or p_posting_external_id is null
        or btrim(p_posting_external_id) = '' then
        raise exception 'Match identifiers are required';
    end if;

    if p_matched_amount is null or p_matched_amount <= 0 then
        raise exception 'Matched amount must be greater than zero';
    end if;

    if p_posting_amount is null or p_posting_amount = 0 then
        raise exception 'Posting amount is required and cannot be zero';
    end if;

    if p_posting_direction not in ('expense', 'income') then
        raise exception 'Invalid posting direction';
    end if;

    if p_posting_direction <> (
        case
        when p_posting_amount < 0 then 'expense'
        else 'income'
        end
    ) then
        raise exception 'Posting direction does not match the posting amount';
    end if;

    if p_match_type not in ('automatic', 'manual') then
        raise exception 'Invalid finance match type';
    end if;

    v_posting_lock := pg_catalog.hashtextextended(
        'finance-posting:' || p_posting_external_id,
        0
    );
    v_plan_item_lock := pg_catalog.hashtextextended(
        'finance-plan-item:' || p_plan_item_id::text,
        0
    );

    perform pg_catalog.pg_advisory_xact_lock(
        least(v_posting_lock, v_plan_item_lock)
    );
    if v_posting_lock <> v_plan_item_lock then
        perform pg_catalog.pg_advisory_xact_lock(
            greatest(v_posting_lock, v_plan_item_lock)
        );
    end if;

    select *
    into v_plan_item
    from public.finance_plan_items
    where id = p_plan_item_id
    for update;

    if not found then
        raise exception 'Finance plan item not found';
    end if;

    -- FR-M8: a disabled Planposten is excluded from every plan total, so
    -- letting it absorb a posting would hide that money from the forecast.
    if not v_plan_item.is_active then
        raise exception 'Finance plan item is disabled';
    end if;

    if v_plan_item.direction <> p_posting_direction then
        raise exception
            'Posting direction does not match the plan item direction';
    end if;

    v_posting_cents := floor(p_posting_amount * 100 + 0.5)::bigint;

    with ordered_allocations as (
        select
            a.*,
            row_number() over (
                order by
                    coalesce(a.department, '') collate "C",
                    coalesce(a.project_id::text, '') collate "C",
                    coalesce(a.tax_area, '') collate "C"
            ) as allocation_order,
            count(*) over () as allocation_count
        from public.finance_posting_allocations a
        where a.posting_external_id = p_posting_external_id
    ),
    rounded_allocations as (
        select
            ordered_allocations.*,
            case
                when allocation_order < allocation_count then
                    floor(
                        v_posting_cents
                        * allocated_percentage
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
    select
        count(*),
        coalesce(
            sum(abs(allocated_cents)) filter (
                where department = v_plan_item.department
                    and project_id is not distinct from v_plan_item.project_id
            ),
            0
        )
    into v_allocation_count, v_scope_allocated_cents
    from apportioned_allocations;

    if v_allocation_count = 0 then
        v_effective_posting_capacity := abs(p_posting_amount);
    else
        v_effective_posting_capacity :=
            v_scope_allocated_cents::numeric / 100;
    end if;

    select coalesce(sum(m.matched_amount), 0)
    into v_posting_matched
    from public.finance_plan_item_posting_matches m
    join public.finance_plan_items pi on pi.id = m.plan_item_id
    where m.posting_external_id = p_posting_external_id
        and pi.department = v_plan_item.department
        and pi.project_id is not distinct from v_plan_item.project_id;

    if v_posting_matched + p_matched_amount
        > v_effective_posting_capacity then
        raise exception
            'Matched amount exceeds the posting''s available amount';
    end if;

    select coalesce(sum(matched_amount), 0)
    into v_plan_item_matched
    from public.finance_plan_item_posting_matches
    where plan_item_id = p_plan_item_id;

    if v_plan_item_matched + p_matched_amount
        > v_plan_item.planned_amount + 0.01 then
        raise exception
            'Matched amount exceeds the plan item''s planned amount';
    end if;

    insert into public.finance_plan_item_posting_matches (
        id,
        plan_item_id,
        posting_external_id,
        matched_amount,
        match_type,
        created_by
    )
    values (
        p_id,
        p_plan_item_id,
        p_posting_external_id,
        p_matched_amount,
        p_match_type,
        p_actor
    )
    returning * into v_match;

    -- FR-M4: fully covered → spent, partially covered → committed. Only ever
    -- forward, so a manual override to a later status survives a later match.
    v_next_status := case
        when v_plan_item_matched + p_matched_amount
            >= v_plan_item.planned_amount - 0.01
        then 'spent'
        else 'committed'
    end;

    if public.finance_plan_status_rank(v_next_status)
        > public.finance_plan_status_rank(v_plan_item.status) then
        update public.finance_plan_items
        set status = v_next_status,
            updated_at = now()
        where id = p_plan_item_id;
    end if;

    return to_jsonb(v_match);
exception
    when unique_violation then
        raise exception 'This plan item is already matched to the posting';
end;
$$;

revoke all
on function "public"."create_finance_plan_item_posting_match"(
    uuid,
    uuid,
    text,
    numeric,
    text,
    uuid,
    numeric,
    text
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."create_finance_plan_item_posting_match"(
    uuid,
    uuid,
    text,
    numeric,
    text,
    uuid,
    numeric,
    text
)
to service_role;

-- FR-M7: detaching the last match walks the Planposten back to 'planned', and a
-- partial detach back to 'committed'. Mirrors the forward automation above so
-- the status always reflects the matches that actually exist.
create or replace function "public"."delete_finance_plan_item_posting_match"(
    "p_id" uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_match public.finance_plan_item_posting_matches%rowtype;
    v_plan_item public.finance_plan_items%rowtype;
    v_remaining numeric;
    v_next_status text;
begin
    select *
    into v_match
    from public.finance_plan_item_posting_matches
    where id = p_id;

    if not found then
        raise exception 'Plan item posting match not found';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'finance-plan-item:' || v_match.plan_item_id::text,
            0
        )
    );

    select *
    into v_plan_item
    from public.finance_plan_items
    where id = v_match.plan_item_id
    for update;

    delete from public.finance_plan_item_posting_matches
    where id = p_id;

    if not found then
        return;
    end if;

    select coalesce(sum(matched_amount), 0)
    into v_remaining
    from public.finance_plan_item_posting_matches
    where plan_item_id = v_match.plan_item_id;

    v_next_status := case
        when v_remaining <= 0 then 'planned'
        when v_remaining >= v_plan_item.planned_amount - 0.01 then 'spent'
        else 'committed'
    end;

    if v_next_status is distinct from v_plan_item.status then
        update public.finance_plan_items
        set status = v_next_status,
            updated_at = now()
        where id = v_match.plan_item_id;
    end if;
end;
$$;

revoke all
on function "public"."delete_finance_plan_item_posting_match"(uuid)
from public, anon, authenticated, service_role;
grant execute
on function "public"."delete_finance_plan_item_posting_match"(uuid)
to service_role;

commit;
