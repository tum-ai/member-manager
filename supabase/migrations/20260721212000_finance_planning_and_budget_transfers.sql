begin;

-- Canonical tax areas follow the BuchhaltungsButler account suffixes:
-- 10 = ideell, 40 = wirtschaftlich, 50 = gemischt.
alter table "public"."finance_department_mappings"
    drop constraint if exists "finance_department_mappings_bereich_check";
update "public"."finance_department_mappings"
set "bereich" = 'gemischt'
where "bereich" = 'zweckbetrieb';
alter table "public"."finance_department_mappings"
    add constraint "finance_department_mappings_bereich_check"
    check ("bereich" in ('ideell', 'wirtschaftlich', 'gemischt'));

alter table "public"."finance_projects"
    drop constraint if exists "finance_projects_tax_area_check";
update "public"."finance_projects"
set "tax_area" = 'gemischt'
where "tax_area" = 'zweckbetrieb';
alter table "public"."finance_projects"
    add constraint "finance_projects_tax_area_check"
    check ("tax_area" in ('ideell', 'wirtschaftlich', 'gemischt'));

alter table "public"."finance_plan_templates"
    drop constraint if exists "finance_plan_templates_tax_area_check";
update "public"."finance_plan_templates"
set "tax_area" = 'gemischt'
where "tax_area" = 'zweckbetrieb';
alter table "public"."finance_plan_templates"
    add constraint "finance_plan_templates_tax_area_check"
    check ("tax_area" in ('ideell', 'wirtschaftlich', 'gemischt'));

alter table "public"."finance_posting_allocations"
    drop constraint if exists "finance_posting_allocations_tax_area_check";
update "public"."finance_posting_allocations"
set "tax_area" = 'gemischt'
where "tax_area" = 'zweckbetrieb';
alter table "public"."finance_posting_allocations"
    add constraint "finance_posting_allocations_tax_area_check"
    check ("tax_area" in ('ideell', 'wirtschaftlich', 'gemischt'));

alter table "public"."finance_reallocation_request_items"
    drop constraint if exists "finance_reallocation_request_items_tax_area_check";
update "public"."finance_reallocation_request_items"
set "tax_area" = 'gemischt'
where "tax_area" = 'zweckbetrieb';
alter table "public"."finance_reallocation_request_items"
    add constraint "finance_reallocation_request_items_tax_area_check"
    check ("tax_area" in ('ideell', 'wirtschaftlich', 'gemischt'));

alter table "public"."finance_plan_items"
    add column "direction" text not null default 'expense'
    check ("direction" in ('income', 'expense'));

alter table "public"."finance_plan_template_items"
    add column "direction" text not null default 'expense'
    check ("direction" in ('income', 'expense'));

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

    return to_jsonb(v_match);
exception
    when unique_violation then
        raise exception 'This plan item is already matched to the posting';
end;
$$;

create or replace function "public"."update_finance_plan_item"(
    "p_id" uuid,
    "p_label" text,
    "p_category" text,
    "p_direction" text,
    "p_planned_amount" numeric,
    "p_expected_month" text,
    "p_status" text,
    "p_note" text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_plan_item public.finance_plan_items%rowtype;
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

    update public.finance_plan_items
    set
        label = p_label,
        category = p_category,
        direction = coalesce(p_direction, v_plan_item.direction),
        planned_amount = p_planned_amount,
        expected_month = p_expected_month,
        status = p_status,
        note = p_note,
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
    text
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
    text
)
to service_role;

create or replace function "public"."assign_finance_plan_template"(
    "p_project_id" uuid,
    "p_template_id" uuid,
    "p_actor" uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_project public.finance_projects%rowtype;
    v_template public.finance_plan_templates%rowtype;
    v_items jsonb;
begin
    select *
    into v_project
    from public.finance_projects
    where id = p_project_id;

    if not found then
        raise exception 'Finance project not found';
    end if;

    select *
    into v_template
    from public.finance_plan_templates
    where id = p_template_id;

    if not found then
        raise exception 'Finance plan template not found';
    end if;

    if not v_template.is_active then
        raise exception 'Finance plan template is inactive';
    end if;

    insert into public.finance_project_template_assignments (
        project_id,
        template_id,
        assigned_by
    )
    values (p_project_id, p_template_id, p_actor)
    on conflict (project_id, template_id) do nothing;

    insert into public.finance_plan_items (
        department,
        period_type,
        period_key,
        label,
        category,
        direction,
        planned_amount,
        expected_month,
        status,
        note,
        created_by,
        project_id,
        template_item_id,
        updated_at
    )
    select
        v_project.department,
        v_project.period_type,
        v_project.period_key,
        i.label,
        i.category,
        i.direction,
        i.planned_amount,
        i.expected_month,
        'planned',
        i.note,
        p_actor,
        p_project_id,
        i.id,
        now()
    from public.finance_plan_template_items i
    where i.template_id = p_template_id
    on conflict (project_id, template_item_id)
        where project_id is not null and template_item_id is not null
        do nothing;

    select coalesce(jsonb_agg(to_jsonb(i) order by i.label), '[]'::jsonb)
    into v_items
    from public.finance_plan_items i
    join public.finance_plan_template_items ti
        on ti.id = i.template_item_id
    where i.project_id = p_project_id
        and ti.template_id = p_template_id;

    return jsonb_build_object(
        'project_id', p_project_id,
        'template_id', p_template_id,
        'created_plan_items', v_items
    );
end;
$$;

create table "public"."finance_budget_transfer_requests" (
    "id" uuid primary key default gen_random_uuid(),
    "source_department" text not null,
    "target_department" text not null,
    "period_type" text not null
        check ("period_type" in ('year', 'semester')),
    "period_key" text not null,
    "amount" numeric(14, 2) not null check ("amount" > 0),
    "reason" text not null,
    "status" text not null default 'pending'
        check ("status" in ('pending', 'approved', 'rejected')),
    "requested_by" uuid not null,
    "reviewed_by" uuid,
    "review_note" text,
    "reviewed_at" timestamptz,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "finance_budget_transfer_departments_differ"
        check ("source_department" <> "target_department"),
    constraint "finance_budget_transfer_period_key_check"
        check (
            ("period_type" = 'year' and "period_key" ~ '^[0-9]{4}$')
            or
            (
                "period_type" = 'semester'
                and "period_key" ~ '^(WS|SS)(2[0-9]|[3-9][0-9])$'
            )
        )
);

create index "finance_budget_transfer_requests_scope_idx"
on "public"."finance_budget_transfer_requests"
    ("source_department", "status", "created_at" desc);

alter table "public"."finance_budget_transfer_requests"
    enable row level security;

create policy "Finance reviewers read budget transfer requests"
on "public"."finance_budget_transfer_requests"
as permissive
for select
to authenticated
using (public.is_finance_reviewer());

create policy "Department members read own budget transfer requests"
on "public"."finance_budget_transfer_requests"
as permissive
for select
to authenticated
using (public.is_finance_department_member("source_department"));

create or replace function "public"."review_finance_budget_transfer_request"(
    "p_request_id" uuid,
    "p_decision" text,
    "p_reviewer" uuid,
    "p_review_note" text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_request public.finance_budget_transfer_requests%rowtype;
    v_source_budget public.finance_budgets%rowtype;
begin
    if p_decision not in ('approved', 'rejected') then
        raise exception 'Invalid budget transfer decision';
    end if;

    select *
    into v_request
    from public.finance_budget_transfer_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception 'Budget transfer request not found';
    end if;

    if v_request.status <> 'pending' then
        raise exception 'Budget transfer request has already been reviewed';
    end if;

    if p_decision = 'approved' then
        perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
                v_request.period_type
                    || ':' || v_request.period_key
                    || ':' || least(
                        v_request.source_department,
                        v_request.target_department
                    )
                    || ':' || greatest(
                        v_request.source_department,
                        v_request.target_department
                    ),
                0
            )
        );

        select *
        into v_source_budget
        from public.finance_budgets
        where department = v_request.source_department
            and period_type = v_request.period_type
            and period_key = v_request.period_key
        for update;

        if not found then
            raise exception 'Source department has no budget for the period';
        end if;

        if v_source_budget.amount_planned < v_request.amount then
            raise exception 'Budget transfer exceeds the source budget';
        end if;

        update public.finance_budgets
        set
            amount_planned = amount_planned - v_request.amount,
            set_by = p_reviewer,
            updated_at = now()
        where id = v_source_budget.id;

        insert into public.finance_budgets (
            department,
            period_type,
            period_key,
            amount_planned,
            currency,
            set_by
        )
        values (
            v_request.target_department,
            v_request.period_type,
            v_request.period_key,
            v_request.amount,
            v_source_budget.currency,
            p_reviewer
        )
        on conflict (department, period_type, period_key)
        do update set
            amount_planned =
                public.finance_budgets.amount_planned + excluded.amount_planned,
            set_by = excluded.set_by,
            updated_at = now();
    end if;

    update public.finance_budget_transfer_requests
    set
        status = p_decision,
        reviewed_by = p_reviewer,
        review_note = p_review_note,
        reviewed_at = now(),
        updated_at = now()
    where id = p_request_id
    returning * into v_request;

    return to_jsonb(v_request);
end;
$$;

revoke all
on function "public"."review_finance_budget_transfer_request"(
    uuid,
    text,
    uuid,
    text
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."review_finance_budget_transfer_request"(
    uuid,
    text,
    uuid,
    text
)
to service_role;

-- Finance writes go through the validated Fastify API using service_role.
-- Authenticated users retain only the RLS-scoped reads needed for direct
-- inspection and cannot bypass application invariants.
revoke insert, update, delete
on table
    "public"."finance_department_mappings",
    "public"."finance_category_mappings",
    "public"."finance_account_labels",
    "public"."finance_budgets",
    "public"."finance_plan_items",
    "public"."finance_projects",
    "public"."finance_plan_templates",
    "public"."finance_plan_template_items",
    "public"."finance_project_template_assignments",
    "public"."finance_posting_allocations",
    "public"."finance_reallocation_requests",
    "public"."finance_reallocation_request_items",
    "public"."finance_plan_item_posting_matches",
    "public"."finance_budget_transfer_requests"
from authenticated;

grant select
on table
    "public"."finance_department_mappings",
    "public"."finance_category_mappings",
    "public"."finance_account_labels",
    "public"."finance_budgets",
    "public"."finance_plan_items",
    "public"."finance_projects",
    "public"."finance_plan_templates",
    "public"."finance_plan_template_items",
    "public"."finance_project_template_assignments",
    "public"."finance_posting_allocations",
    "public"."finance_reallocation_requests",
    "public"."finance_reallocation_request_items",
    "public"."finance_plan_item_posting_matches",
    "public"."finance_budget_transfer_requests"
to authenticated;

grant select, insert, update, delete
on table "public"."finance_budget_transfer_requests"
to service_role;

commit;
