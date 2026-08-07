begin;

alter table "public"."members"
    add column if not exists "educational_course_role" text;

alter table "public"."members"
    add constraint "members_educational_course_role_check"
    check (
        "educational_course_role" is null
        or "educational_course_role" in ('participant', 'administrator')
    );

revoke select ("educational_course_role")
on table "public"."members"
from anon, authenticated;

create table "public"."educational_course_periods" (
    "id" uuid primary key default gen_random_uuid(),
    "starts_on" date not null,
    "ends_on" date not null,
    "capacity" integer not null,
    "applications_open" boolean not null default true,
    "created_by" uuid not null references "auth"."users"("id") on delete restrict,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "educational_course_periods_date_range_check"
        check ("starts_on" <= "ends_on"),
    constraint "educational_course_periods_capacity_check"
        check ("capacity" > 0),
    constraint "educational_course_periods_no_overlap"
        exclude using gist (
            daterange("starts_on", "ends_on", '[]') with &&
        )
);

comment on column "public"."educational_course_periods"."starts_on" is
    'First day included in the educational course period.';

comment on column "public"."educational_course_periods"."ends_on" is
    'Last day included in the educational course period.';

create table "public"."educational_course_applications" (
    "id" uuid primary key default gen_random_uuid(),
    "period_id" uuid not null
        references "public"."educational_course_periods"("id") on delete restrict,
    "applicant_user_id" uuid not null
        references "public"."members"("user_id") on delete restrict,
    "status" text not null default 'pending',
    "reviewed_by" uuid references "auth"."users"("id") on delete restrict,
    "reviewed_at" timestamptz,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "educational_course_applications_period_applicant_key"
        unique ("period_id", "applicant_user_id"),
    constraint "educational_course_applications_status_check"
        check ("status" in ('pending', 'approved', 'rejected')),
    constraint "educational_course_applications_review_state_check"
        check (
            (
                "status" = 'pending'
                and "reviewed_by" is null
                and "reviewed_at" is null
            )
            or (
                "status" in ('approved', 'rejected')
                and "reviewed_by" is not null
                and "reviewed_at" is not null
            )
        )
);

create index "educational_course_applications_applicant_created_at_idx"
    on "public"."educational_course_applications" (
        "applicant_user_id",
        "created_at" desc
    );

create index "educational_course_applications_period_status_idx"
    on "public"."educational_course_applications" ("period_id", "status");

create or replace function "private"."set_educational_course_updated_at"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create or replace function "private"."prevent_educational_course_period_definition_change"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.starts_on is distinct from old.starts_on
        or new.ends_on is distinct from old.ends_on
        or new.capacity is distinct from old.capacity then
        raise exception 'Educational course period dates and capacity are immutable'
            using errcode = '22023';
    end if;

    return new;
end;
$$;

create trigger "educational_course_periods_set_updated_at"
before update on "public"."educational_course_periods"
for each row
execute function "private"."set_educational_course_updated_at"();

create trigger "educational_course_periods_prevent_definition_change"
before update of "starts_on", "ends_on", "capacity"
on "public"."educational_course_periods"
for each row
execute function "private"."prevent_educational_course_period_definition_change"();

create trigger "educational_course_applications_set_updated_at"
before update on "public"."educational_course_applications"
for each row
execute function "private"."set_educational_course_updated_at"();

revoke all
on function "private"."set_educational_course_updated_at"()
from public, anon, authenticated;

revoke all
on function "private"."prevent_educational_course_period_definition_change"()
from public, anon, authenticated;

create or replace function "public"."has_educational_course_role"(
    "p_required_role" text default null
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
    select exists (
        select 1
        from public.members member_row
        where member_row.user_id = auth.uid()
          and (
              (
                  p_required_role is null
                  and member_row.educational_course_role in (
                      'participant',
                      'administrator'
                  )
              )
              or member_row.educational_course_role = p_required_role
          )
          and coalesce(
              member_row.member_status,
              case when member_row.active then 'active' else 'inactive' end
          ) = 'active'
    );
$$;

revoke all
on function "public"."has_educational_course_role"(text)
from public, anon, authenticated, service_role;

grant execute
on function "public"."has_educational_course_role"(text)
to authenticated;

alter table "public"."educational_course_periods" enable row level security;
alter table "public"."educational_course_applications" enable row level security;

create policy "Education members read course periods"
    on "public"."educational_course_periods"
    as permissive
    for select
    to authenticated
    using ("public"."has_educational_course_role"());

create policy "Applicants read own course applications"
    on "public"."educational_course_applications"
    as permissive
    for select
    to authenticated
    using (
        "applicant_user_id" = auth.uid()
        and "public"."has_educational_course_role"('participant')
    );

create policy "Education administrators read course applications"
    on "public"."educational_course_applications"
    as permissive
    for select
    to authenticated
    using ("public"."has_educational_course_role"('administrator'));

revoke all on table "public"."educational_course_periods"
from public, anon, authenticated, service_role;
revoke all on table "public"."educational_course_applications"
from public, anon, authenticated, service_role;

grant select on table "public"."educational_course_periods" to authenticated;
grant select on table "public"."educational_course_applications" to authenticated;

grant select, insert, update, delete
on table "public"."educational_course_periods"
to service_role;

grant select, delete
on table "public"."educational_course_applications"
to service_role;

create or replace function "public"."apply_educational_course_period"(
    "p_period_id" uuid,
    "p_applicant_user_id" uuid
)
returns "public"."educational_course_applications"
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_member public.members%rowtype;
    v_period public.educational_course_periods%rowtype;
    v_application public.educational_course_applications%rowtype;
begin
    select member_row.*
    into v_member
    from public.members member_row
    where member_row.user_id = p_applicant_user_id
    for update;

    if not found then
        raise exception 'Applicant must be an active educational course participant'
            using errcode = '42501';
    end if;

    if v_member.educational_course_role is distinct from 'participant'
        or coalesce(
            v_member.member_status,
            case when v_member.active then 'active' else 'inactive' end
        ) <> 'active' then
        raise exception 'Applicant must be an active educational course participant'
            using errcode = '42501';
    end if;

    select period.*
    into v_period
    from public.educational_course_periods period
    where period.id = p_period_id
    for update;

    if not found then
        raise exception 'Educational course period not found'
            using errcode = 'P0002';
    end if;

    if not v_period.applications_open
        or v_period.starts_on <= (
            current_timestamp at time zone 'Europe/Berlin'
        )::date then
        raise exception 'Applications are closed for this educational course period'
            using errcode = '55000';
    end if;

    insert into public.educational_course_applications (
        period_id,
        applicant_user_id,
        status
    )
    values (
        p_period_id,
        p_applicant_user_id,
        'pending'
    )
    returning * into v_application;

    return v_application;
end;
$$;

revoke all
on function "public"."apply_educational_course_period"(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute
on function "public"."apply_educational_course_period"(uuid, uuid)
to service_role;

create or replace function "public"."review_educational_course_application"(
    "p_application_id" uuid,
    "p_status" text,
    "p_reviewer_user_id" uuid
)
returns "public"."educational_course_applications"
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_application public.educational_course_applications%rowtype;
    v_period public.educational_course_periods%rowtype;
    v_period_id uuid;
    v_approved_count integer;
begin
    if p_status is null or p_status not in ('approved', 'rejected') then
        raise exception 'Educational course review status must be approved or rejected'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.members member_row
        where member_row.user_id = p_reviewer_user_id
          and member_row.educational_course_role = 'administrator'
          and coalesce(
              member_row.member_status,
              case when member_row.active then 'active' else 'inactive' end
          ) = 'active'
    ) then
        raise exception 'Reviewer must be an active educational course administrator'
            using errcode = '42501';
    end if;

    select application.period_id
    into v_period_id
    from public.educational_course_applications application
    where application.id = p_application_id;

    if not found then
        raise exception 'Educational course application not found'
            using errcode = 'P0002';
    end if;

    select period.*
    into v_period
    from public.educational_course_periods period
    where period.id = v_period_id
    for update;

    if not found then
        raise exception 'Educational course period not found'
            using errcode = 'P0002';
    end if;

    select application.*
    into v_application
    from public.educational_course_applications application
    where application.id = p_application_id
    for update;

    if not found then
        raise exception 'Educational course application not found'
            using errcode = 'P0002';
    end if;

    if v_application.period_id is distinct from v_period.id then
        raise exception 'Educational course application period changed during review'
            using errcode = '40001';
    end if;

    -- A reviewer promoted from participant keeps their own pending application,
    -- so block self review explicitly instead of relying on the role check above.
    if v_application.applicant_user_id = p_reviewer_user_id then
        raise exception 'Educational course administrators cannot review their own application'
            using errcode = '42501';
    end if;

    -- Roles and membership can change after the application was filed; only
    -- applications from members who are still active participants stay reviewable.
    if not exists (
        select 1
        from public.members member_row
        where member_row.user_id = v_application.applicant_user_id
          and member_row.educational_course_role = 'participant'
          and coalesce(
              member_row.member_status,
              case when member_row.active then 'active' else 'inactive' end
          ) = 'active'
    ) then
        raise exception 'Applicant is no longer an active educational course participant'
            using errcode = '55000';
    end if;

    if p_status = 'approved' then
        select count(*)::integer
        into v_approved_count
        from public.educational_course_applications application
        where application.period_id = v_period.id
          and application.status = 'approved'
          and application.id <> p_application_id;

        if v_approved_count >= v_period.capacity then
            raise exception 'Educational course period is at capacity'
                using errcode = '23514';
        end if;
    end if;

    update public.educational_course_applications
    set
        status = p_status,
        reviewed_by = p_reviewer_user_id,
        reviewed_at = now()
    where id = p_application_id
    returning * into v_application;

    return v_application;
end;
$$;

revoke all
on function "public"."review_educational_course_application"(uuid, text, uuid)
from public, anon, authenticated, service_role;

grant execute
on function "public"."review_educational_course_application"(uuid, text, uuid)
to service_role;

create or replace function "private"."reconcile_educational_course_applications"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Losing the participant role (removal, promotion to administrator) or
    -- going inactive withdraws the member from anything not yet reviewed, so a
    -- stale row can never be approved later. Reviewed rows stay as history.
    if new.educational_course_role is distinct from 'participant'
        or coalesce(
            new.member_status,
            case when new.active then 'active' else 'inactive' end
        ) <> 'active' then
        delete from public.educational_course_applications
        where applicant_user_id = new.user_id
          and status = 'pending';
    end if;

    return new;
end;
$$;

create trigger "members_reconcile_educational_course_applications"
after update of "educational_course_role", "member_status", "active"
on "public"."members"
for each row
execute function "private"."reconcile_educational_course_applications"();

create or replace function "public"."merge_duplicate_member"(
    "p_source_user_id" uuid,
    "p_target_user_id" uuid,
    "p_admin_user_id" uuid,
    "p_note" text default null
)
returns table (
    "source_user_id" uuid,
    "target_user_id" uuid,
    "audit_id" uuid,
    "transferred_counts" jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_source public.members%rowtype;
    v_target public.members%rowtype;
    v_audit_id uuid := gen_random_uuid();
    v_counts jsonb := '{}'::jsonb;
    v_count integer;
    v_target_has_sepa boolean;
    v_target_has_current_cv boolean;
    v_target_max_cv_version integer;
    v_source_snapshot jsonb;
begin
    if p_source_user_id = p_target_user_id then
        raise exception 'source and target members must differ'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.user_roles
        where user_id = p_admin_user_id and role = 'admin'
    ) then
        raise exception 'admin must have admin role'
            using errcode = '42501';
    end if;

    select *
    into v_target
    from public.members
    where user_id = p_target_user_id
    for update;

    if not found then
        raise exception 'target member not found'
            using errcode = 'P0002';
    end if;

    select *
    into v_source
    from public.members
    where user_id = p_source_user_id
    for update;

    if not found then
        raise exception 'source member not found'
            using errcode = 'P0002';
    end if;

    if exists (
        select 1
        from public.tumai_day_responses source_response
        where source_response.user_id = p_source_user_id
          and exists (
              select 1
              from public.tumai_day_responses target_response
              where target_response.tumai_day_id = source_response.tumai_day_id
                and target_response.user_id = p_target_user_id
          )
    ) then
        raise exception 'TUM.ai Day response conflicts must be resolved before merging'
            using errcode = '23505';
    end if;

    if exists (
        select 1
        from public.educational_course_applications source_application
        where source_application.applicant_user_id = p_source_user_id
          and exists (
              select 1
              from public.educational_course_applications target_application
              where target_application.period_id = source_application.period_id
                and target_application.applicant_user_id = p_target_user_id
          )
    ) then
        raise exception 'Educational course application conflicts must be resolved before merging'
            using errcode = '23505';
    end if;

    v_source_snapshot := jsonb_build_object(
        'member', to_jsonb(v_source),
        'sepa', (
            select coalesce(jsonb_agg(to_jsonb(sepa_row)), '[]'::jsonb)
            from public.sepa sepa_row
            where sepa_row.user_id = p_source_user_id
        ),
        'member_agreements', (
            select coalesce(jsonb_agg(to_jsonb(agreement_row)), '[]'::jsonb)
            from public.member_agreements agreement_row
            where agreement_row.user_id = p_source_user_id
        )
    );

    insert into public.member_merge_audit (
        id,
        source_user_id,
        target_user_id,
        merged_by,
        note,
        source_snapshot,
        transferred_counts
    )
    values (
        v_audit_id,
        p_source_user_id,
        p_target_user_id,
        p_admin_user_id,
        nullif(trim(p_note), ''),
        v_source_snapshot,
        v_counts
    );

    insert into public.member_agreements (
        user_id,
        sepa_mandate_agreed,
        privacy_policy_agreed,
        data_privacy_notice_agreed,
        created_at,
        updated_at
    )
    select
        p_target_user_id,
        sepa_mandate_agreed,
        privacy_policy_agreed,
        data_privacy_notice_agreed,
        created_at,
        now()
    from public.member_agreements
    where user_id = p_source_user_id
    on conflict (user_id) do update set
        sepa_mandate_agreed = public.member_agreements.sepa_mandate_agreed
            or excluded.sepa_mandate_agreed,
        privacy_policy_agreed = public.member_agreements.privacy_policy_agreed
            or excluded.privacy_policy_agreed,
        data_privacy_notice_agreed =
            public.member_agreements.data_privacy_notice_agreed
            or excluded.data_privacy_notice_agreed,
        updated_at = now();

    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('member_agreements', v_count);

    delete from public.member_agreements
    where user_id = p_source_user_id;

    select exists (
        select 1 from public.sepa where user_id = p_target_user_id
    )
    into v_target_has_sepa;

    if v_target_has_sepa then
        delete from public.sepa
        where user_id = p_source_user_id;
    else
        update public.sepa
        set user_id = p_target_user_id
        where user_id = p_source_user_id;
    end if;

    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('sepa', v_count);

    update public.member_role_history
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('member_role_history', v_count);

    update public.member_change_requests
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('member_change_requests', v_count);

    update public.engagement_certificate_requests
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('engagement_certificate_requests', v_count);

    update public.job_posting_requests
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('job_posting_requests', v_count);

    update public.reimbursements
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('reimbursements', v_count);

    update public.reimbursements
    set bb_synced_by = p_target_user_id
    where bb_synced_by = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('reimbursements_bb_synced_by', v_count);

    v_counts := v_counts || jsonb_build_object('tumai_day_response_conflicts', 0);

    update public.tumai_day_responses
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('tumai_day_responses', v_count);

    v_counts := v_counts || jsonb_build_object(
        'educational_course_application_conflicts',
        0
    );

    update public.educational_course_applications
    set applicant_user_id = p_target_user_id
    where applicant_user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object(
        'educational_course_applications',
        v_count
    );

    update public.contract_submissions
    set submitter_user_id = p_target_user_id
    where submitter_user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('contract_submissions', v_count);

    select exists (
        select 1
        from public.member_cvs
        where user_id = p_target_user_id and is_current = true
    )
    into v_target_has_current_cv;

    if v_target_has_current_cv then
        update public.member_cvs
        set is_current = false
        where user_id = p_source_user_id and is_current = true;
    end if;

    select coalesce(max(version), 0)
    into v_target_max_cv_version
    from public.member_cvs
    where user_id = p_target_user_id;

    update public.member_cvs
    set
        user_id = p_target_user_id,
        version = version + v_target_max_cv_version
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('member_cvs', v_count);

    update public.members
    set educational_course_role = case
        when v_target.educational_course_role = 'administrator'
            or v_source.educational_course_role = 'administrator'
            then 'administrator'
        when v_target.educational_course_role = 'participant'
            or v_source.educational_course_role = 'participant'
            then 'participant'
        else null
    end
    where user_id = p_target_user_id;

    insert into public.user_roles (user_id, role)
    select p_target_user_id, role
    from public.user_roles
    where user_id = p_source_user_id
    on conflict (user_id) do update set
        role = case
            when public.user_roles.role = 'admin' or excluded.role = 'admin'
                then 'admin'
            else 'user'
        end;

    delete from public.user_roles
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('user_roles', v_count);

    delete from public.members
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('members', v_count);

    update public.member_merge_audit
    set transferred_counts = v_counts
    where id = v_audit_id;

    return query
    select p_source_user_id, p_target_user_id, v_audit_id, v_counts;
end;
$$;

revoke all
on function "public"."merge_duplicate_member"(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute
on function "public"."merge_duplicate_member"(uuid, uuid, uuid, text)
to service_role;

commit;
