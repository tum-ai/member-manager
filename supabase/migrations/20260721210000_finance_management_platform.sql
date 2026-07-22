begin;

-- Harden the existing department predicate before reusing it in new policies.
create or replace function "public"."is_finance_department_member"(
    "target_department" text
)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
    return exists (
        select 1
        from public.members m
        join public.department_permissions dp
            on dp.department = m.department
        where m.user_id = auth.uid()
            and m.active = true
            and m.department = target_department
            and dp.permissions ? 'finance.department'
    );
end;
$$;

create or replace function "public"."is_finance_viewer"()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select
        public.is_finance_reviewer()
        or exists (
            select 1
            from public.members m
            join public.department_permissions dp
                on dp.department = m.department
            where m.user_id = auth.uid()
                and m.active = true
                and dp.permissions ? 'finance.department'
        );
$$;

revoke all
on function "public"."is_finance_department_member"(text)
from public, anon, authenticated, service_role;
grant execute
on function "public"."is_finance_department_member"(text)
to authenticated, service_role;

revoke all
on function "public"."is_finance_viewer"()
from public, anon, authenticated, service_role;
grant execute
on function "public"."is_finance_viewer"()
to authenticated, service_role;

create table "public"."finance_projects" (
    "id" uuid primary key default gen_random_uuid(),
    "parent_project_id" uuid
        references "public"."finance_projects"("id") on delete set null,
    "name" text not null,
    "department" text not null,
    "period_type" text not null
        check ("period_type" in ('year', 'semester')),
    "period_key" text not null,
    "tax_area" text
        check ("tax_area" in ('ideell', 'wirtschaftlich', 'zweckbetrieb')),
    "target_amount" numeric(14, 2) not null default 0,
    "status" text not null default 'draft'
        check ("status" in ('draft', 'active', 'completed', 'cancelled')),
    "description" text,
    "created_by" uuid,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "finance_projects_parent_not_self"
        check ("parent_project_id" is null or "parent_project_id" <> "id"),
    constraint "finance_projects_period_key_check"
        check (
            ("period_type" = 'year' and "period_key" ~ '^[0-9]{4}$')
            or
            (
                "period_type" = 'semester'
                and "period_key" ~ '^(WS|SS)(2[0-9]|[3-9][0-9])$'
            )
        )
);

create index "finance_projects_scope_idx"
on "public"."finance_projects"
    ("period_type", "period_key", "department", "status");

create index "finance_projects_parent_idx"
on "public"."finance_projects" ("parent_project_id")
where "parent_project_id" is not null;

create table "public"."finance_plan_templates" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "tax_area" text
        check ("tax_area" in ('ideell', 'wirtschaftlich', 'zweckbetrieb')),
    "is_active" boolean not null default true,
    "created_by" uuid,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

create table "public"."finance_plan_template_items" (
    "id" uuid primary key default gen_random_uuid(),
    "template_id" uuid not null
        references "public"."finance_plan_templates"("id") on delete cascade,
    "label" text not null,
    "category" text,
    "planned_amount" numeric(14, 2) not null default 0
        check ("planned_amount" >= 0),
    "expected_month" text
        check (
            "expected_month" is null
            or "expected_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
        ),
    "note" text,
    "sort_order" integer not null default 0,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

create index "finance_plan_template_items_template_idx"
on "public"."finance_plan_template_items" ("template_id", "sort_order", "id");

alter table "public"."finance_plan_items"
    add column "project_id" uuid
        references "public"."finance_projects"("id") on delete set null,
    add column "template_item_id" uuid
        references "public"."finance_plan_template_items"("id") on delete set null;

create index "finance_plan_items_project_idx"
on "public"."finance_plan_items" ("project_id")
where "project_id" is not null;

create unique index "finance_plan_items_project_template_item_idx"
on "public"."finance_plan_items" ("project_id", "template_item_id")
where "project_id" is not null and "template_item_id" is not null;

create table "public"."finance_project_template_assignments" (
    "id" uuid primary key default gen_random_uuid(),
    "project_id" uuid not null
        references "public"."finance_projects"("id") on delete cascade,
    "template_id" uuid not null
        references "public"."finance_plan_templates"("id") on delete restrict,
    "assigned_by" uuid,
    "assigned_at" timestamptz not null default now(),
    unique ("project_id", "template_id")
);

create table "public"."finance_posting_allocations" (
    "id" uuid primary key default gen_random_uuid(),
    "posting_external_id" text not null,
    "department" text,
    "project_id" uuid
        references "public"."finance_projects"("id") on delete set null,
    "tax_area" text
        check ("tax_area" in ('ideell', 'wirtschaftlich', 'zweckbetrieb')),
    "allocated_amount" numeric(14, 2) not null
        check ("allocated_amount" <> 0),
    "allocated_percentage" numeric(7, 4) not null
        check (
            "allocated_percentage" > 0
            and "allocated_percentage" <= 100
        ),
    "note" text,
    "created_by" uuid,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "finance_posting_allocations_target_check"
        check (
            "department" is not null
            or "project_id" is not null
            or "tax_area" is not null
        )
);

create index "finance_posting_allocations_posting_idx"
on "public"."finance_posting_allocations" ("posting_external_id");

create unique index "finance_posting_allocations_target_idx"
on "public"."finance_posting_allocations"
    ("posting_external_id", "department", "project_id", "tax_area")
nulls not distinct;

create index "finance_posting_allocations_department_idx"
on "public"."finance_posting_allocations" ("department")
where "department" is not null;

create table "public"."finance_reallocation_requests" (
    "id" uuid primary key default gen_random_uuid(),
    "posting_external_id" text not null,
    "requesting_department" text not null,
    "reason" text not null,
    "status" text not null default 'pending'
        check ("status" in ('pending', 'approved', 'rejected')),
    "allocation_snapshot" jsonb not null default '[]'::jsonb,
    "requested_by" uuid not null,
    "reviewed_by" uuid,
    "review_note" text,
    "reviewed_at" timestamptz,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

create index "finance_reallocation_requests_scope_idx"
on "public"."finance_reallocation_requests"
    ("requesting_department", "status", "created_at" desc);

create unique index "finance_reallocation_requests_pending_posting_idx"
on "public"."finance_reallocation_requests" ("posting_external_id")
where "status" = 'pending';

create table "public"."finance_reallocation_request_items" (
    "id" uuid primary key default gen_random_uuid(),
    "request_id" uuid not null
        references "public"."finance_reallocation_requests"("id")
        on delete cascade,
    "posting_external_id" text not null,
    "department" text,
    "project_id" uuid
        references "public"."finance_projects"("id") on delete set null,
    "tax_area" text
        check ("tax_area" in ('ideell', 'wirtschaftlich', 'zweckbetrieb')),
    "allocated_amount" numeric(14, 2) not null
        check ("allocated_amount" <> 0),
    "allocated_percentage" numeric(7, 4) not null
        check (
            "allocated_percentage" > 0
            and "allocated_percentage" <= 100
        ),
    "note" text,
    "created_by" uuid,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "finance_reallocation_request_items_target_check"
        check (
            "department" is not null
            or "project_id" is not null
            or "tax_area" is not null
        )
);

create index "finance_reallocation_request_items_request_idx"
on "public"."finance_reallocation_request_items" ("request_id");

create unique index "finance_reallocation_request_items_target_idx"
on "public"."finance_reallocation_request_items"
    ("request_id", "department", "project_id", "tax_area")
nulls not distinct;

create table "public"."finance_plan_item_posting_matches" (
    "id" uuid primary key default gen_random_uuid(),
    "plan_item_id" uuid not null
        references "public"."finance_plan_items"("id") on delete cascade,
    "posting_external_id" text not null,
    "matched_amount" numeric(14, 2) not null
        check ("matched_amount" > 0),
    "match_type" text not null
        check ("match_type" in ('automatic', 'manual')),
    "created_by" uuid,
    "created_at" timestamptz not null default now(),
    unique ("plan_item_id", "posting_external_id")
);

create index "finance_plan_item_posting_matches_posting_idx"
on "public"."finance_plan_item_posting_matches" ("posting_external_id");

alter table "public"."finance_projects" enable row level security;
alter table "public"."finance_plan_templates" enable row level security;
alter table "public"."finance_plan_template_items" enable row level security;
alter table "public"."finance_project_template_assignments"
    enable row level security;
alter table "public"."finance_posting_allocations" enable row level security;
alter table "public"."finance_reallocation_requests" enable row level security;
alter table "public"."finance_reallocation_request_items"
    enable row level security;
alter table "public"."finance_plan_item_posting_matches"
    enable row level security;
alter table "public"."finance_plan_items" enable row level security;

create policy "Finance users read scoped projects"
on "public"."finance_projects"
as permissive
for select
to authenticated
using (
    public.is_finance_reviewer()
    or public.is_finance_department_member("department")
);

create policy "Finance viewers read plan templates"
on "public"."finance_plan_templates"
as permissive
for select
to authenticated
using (public.is_finance_viewer());

create policy "Finance viewers read plan template items"
on "public"."finance_plan_template_items"
as permissive
for select
to authenticated
using (public.is_finance_viewer());

create policy "Finance users read scoped template assignments"
on "public"."finance_project_template_assignments"
as permissive
for select
to authenticated
using (
    exists (
        select 1
        from public.finance_projects p
        where p.id =
            finance_project_template_assignments.project_id
            and (
                public.is_finance_reviewer()
                or public.is_finance_department_member(p.department)
            )
    )
);

create policy "Finance reviewers read posting allocations"
on "public"."finance_posting_allocations"
as permissive
for select
to authenticated
using (public.is_finance_reviewer());

create policy "Department members read own posting allocations"
on "public"."finance_posting_allocations"
as permissive
for select
to authenticated
using (
    "department" is not null
    and public.is_finance_department_member("department")
);

create policy "Finance reviewers read reallocation requests"
on "public"."finance_reallocation_requests"
as permissive
for select
to authenticated
using (public.is_finance_reviewer());

create policy "Department members read own reallocation requests"
on "public"."finance_reallocation_requests"
as permissive
for select
to authenticated
using (
    public.is_finance_department_member("requesting_department")
);

create policy "Finance reviewers read reallocation request items"
on "public"."finance_reallocation_request_items"
as permissive
for select
to authenticated
using (public.is_finance_reviewer());

create policy "Department members read own reallocation request items"
on "public"."finance_reallocation_request_items"
as permissive
for select
to authenticated
using (
    exists (
        select 1
        from public.finance_reallocation_requests r
        where r.id = finance_reallocation_request_items.request_id
            and public.is_finance_department_member(
                r.requesting_department
            )
    )
);

create policy "Finance users read scoped posting matches"
on "public"."finance_plan_item_posting_matches"
as permissive
for select
to authenticated
using (
    exists (
        select 1
        from public.finance_plan_items i
        where i.id = finance_plan_item_posting_matches.plan_item_id
            and (
                public.is_finance_reviewer()
                or public.is_finance_department_member(i.department)
            )
    )
);

drop policy if exists "Finance reviewers manage plan items"
on "public"."finance_plan_items";
drop policy if exists "Department members manage own plan items"
on "public"."finance_plan_items";

create policy "Finance users read scoped plan items"
on "public"."finance_plan_items"
as permissive
for select
to authenticated
using (
    public.is_finance_reviewer()
    or public.is_finance_department_member("department")
);

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
                and nullif(entry ->> 'project_id', '')::uuid
                    is not distinct from matched_scope.project_id
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

create or replace function "public"."create_finance_reallocation_request"(
    "p_posting_external_id" text,
    "p_requesting_department" text,
    "p_reason" text,
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
    v_request public.finance_reallocation_requests%rowtype;
    v_percentage numeric;
    v_items jsonb;
    v_allocation_snapshot jsonb;
    v_posting_cents bigint;
    v_canonical_allocations jsonb;
begin
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'finance-posting:' || p_posting_external_id,
            0
        )
    );

    if jsonb_typeof(p_allocations) <> 'array'
        or jsonb_array_length(p_allocations) = 0 then
        raise exception 'At least one requested allocation is required';
    end if;

    if p_posting_amount is null or p_posting_amount = 0 then
        raise exception 'Posting amount is required and cannot be zero';
    end if;

    select sum((entry ->> 'allocated_percentage')::numeric)
    into v_percentage
    from jsonb_array_elements(p_allocations) as entries(entry);

    if abs(coalesce(v_percentage, 0) - 100) > 0.01 then
        raise exception 'Requested allocation percentages must total 100';
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
        raise exception 'Requested allocation targets must be unique';
    end if;

    if exists (
        select 1
        from public.finance_reallocation_requests
        where posting_external_id = p_posting_external_id
            and status = 'pending'
    ) then
        raise exception
            'A pending reallocation request already exists for this posting';
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

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'department', a.department,
                'project_id', a.project_id,
                'tax_area', a.tax_area,
                'allocated_amount', a.allocated_amount,
                'allocated_percentage', a.allocated_percentage,
                'note', a.note
            )
            order by
                coalesce(a.department, ''),
                coalesce(a.project_id::text, ''),
                coalesce(a.tax_area, '')
        ),
        '[]'::jsonb
    )
    into v_allocation_snapshot
    from public.finance_posting_allocations a
    where a.posting_external_id = p_posting_external_id;

    insert into public.finance_reallocation_requests (
        posting_external_id,
        requesting_department,
        reason,
        allocation_snapshot,
        requested_by
    )
    values (
        p_posting_external_id,
        p_requesting_department,
        p_reason,
        v_allocation_snapshot,
        p_actor
    )
    returning * into v_request;

    insert into public.finance_reallocation_request_items (
        request_id,
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
        v_request.id,
        p_posting_external_id,
        nullif(entry ->> 'department', ''),
        nullif(entry ->> 'project_id', '')::uuid,
        nullif(entry ->> 'tax_area', ''),
        (entry ->> 'allocated_amount')::numeric,
        (entry ->> 'allocated_percentage')::numeric,
        nullif(entry ->> 'note', ''),
        p_actor
    from jsonb_array_elements(v_canonical_allocations) as entries(entry);

    select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
    into v_items
    from public.finance_reallocation_request_items i
    where i.request_id = v_request.id;

    return to_jsonb(v_request)
        - 'allocation_snapshot'
        || jsonb_build_object('allocations', v_items);
exception
    when unique_violation then
        raise exception
            'A pending reallocation request already exists for this posting';
end;
$$;

create or replace function "public"."review_finance_reallocation_request"(
    "p_request_id" uuid,
    "p_decision" text,
    "p_reviewer" uuid,
    "p_review_note" text,
    "p_posting_amount" numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_request public.finance_reallocation_requests%rowtype;
    v_allocations jsonb;
    v_current_snapshot jsonb;
    v_posting_external_id text;
begin
    if p_decision not in ('approved', 'rejected') then
        raise exception 'Invalid reallocation decision';
    end if;

    select posting_external_id
    into v_posting_external_id
    from public.finance_reallocation_requests
    where id = p_request_id;

    if not found then
        raise exception 'Reallocation request not found';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'finance-posting:' || v_posting_external_id,
            0
        )
    );

    select *
    into v_request
    from public.finance_reallocation_requests
    where id = p_request_id
    for update;

    if v_request.status <> 'pending' then
        raise exception 'Reallocation request has already been reviewed';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'department', i.department,
                'project_id', i.project_id,
                'tax_area', i.tax_area,
                'allocated_amount', i.allocated_amount,
                'allocated_percentage', i.allocated_percentage,
                'note', i.note
            )
            order by i.id
        ),
        '[]'::jsonb
    )
    into v_allocations
    from public.finance_reallocation_request_items i
    where i.request_id = p_request_id;

    if p_decision = 'approved' then
        if p_posting_amount is null or p_posting_amount = 0 then
            raise exception 'Posting amount is required and cannot be zero';
        end if;

        select coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'department', a.department,
                    'project_id', a.project_id,
                    'tax_area', a.tax_area,
                    'allocated_amount', a.allocated_amount,
                    'allocated_percentage', a.allocated_percentage,
                    'note', a.note
                )
                order by
                    coalesce(a.department, ''),
                    coalesce(a.project_id::text, ''),
                    coalesce(a.tax_area, '')
            ),
            '[]'::jsonb
        )
        into v_current_snapshot
        from public.finance_posting_allocations a
        where a.posting_external_id = v_request.posting_external_id;

        if v_current_snapshot <> v_request.allocation_snapshot then
            raise exception
                'Reallocation request is stale because allocations changed';
        end if;

        perform public.replace_finance_posting_allocations(
            v_request.posting_external_id,
            v_allocations,
            p_reviewer,
            p_posting_amount
        );
    end if;

    update public.finance_reallocation_requests
    set
        status = p_decision,
        reviewed_by = p_reviewer,
        review_note = p_review_note,
        reviewed_at = now(),
        updated_at = now()
    where id = p_request_id
    returning * into v_request;

    return to_jsonb(v_request)
        - 'allocation_snapshot'
        || jsonb_build_object(
            'allocations',
            (
                select coalesce(
                    jsonb_agg(to_jsonb(i) order by i.id),
                    '[]'::jsonb
                )
                from public.finance_reallocation_request_items i
                where i.request_id = p_request_id
            )
        );
end;
$$;

revoke all
on function "public"."assign_finance_plan_template"(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute
on function "public"."assign_finance_plan_template"(uuid, uuid, uuid)
to service_role;

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

revoke all
on function "public"."create_finance_reallocation_request"(
    text,
    text,
    text,
    jsonb,
    uuid,
    numeric
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."create_finance_reallocation_request"(
    text,
    text,
    text,
    jsonb,
    uuid,
    numeric
)
to service_role;

revoke all
on function "public"."review_finance_reallocation_request"(
    uuid,
    text,
    uuid,
    text,
    numeric
)
from public, anon, authenticated, service_role;
grant execute
on function "public"."review_finance_reallocation_request"(
    uuid,
    text,
    uuid,
    text,
    numeric
)
to service_role;

revoke all on table "public"."finance_projects"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_projects"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_projects"
to service_role;

revoke all on table "public"."finance_plan_templates"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_plan_templates"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_plan_templates"
to service_role;

revoke all on table "public"."finance_plan_template_items"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_plan_template_items"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_plan_template_items"
to service_role;

revoke all on table "public"."finance_project_template_assignments"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_project_template_assignments"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_project_template_assignments"
to service_role;

revoke all on table "public"."finance_posting_allocations"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_posting_allocations"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_posting_allocations"
to service_role;

revoke all on table "public"."finance_reallocation_requests"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_reallocation_requests"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_reallocation_requests"
to service_role;

revoke all on table "public"."finance_reallocation_request_items"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_reallocation_request_items"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_reallocation_request_items"
to service_role;

revoke all on table "public"."finance_plan_item_posting_matches"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_plan_item_posting_matches"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_plan_item_posting_matches"
to service_role;

revoke all on table "public"."finance_plan_items"
from public, anon, authenticated, service_role;
grant select
on table "public"."finance_plan_items"
to authenticated;
grant select, insert, update, delete
on table "public"."finance_plan_items"
to service_role;

commit;
