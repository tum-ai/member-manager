begin;

create table if not exists "public"."member_merge_audit" (
    "id" uuid primary key default gen_random_uuid(),
    "source_user_id" uuid not null,
    "target_user_id" uuid not null,
    "merged_by" uuid references "auth"."users"("id") on delete set null,
    "note" text,
    "source_snapshot" jsonb not null,
    "transferred_counts" jsonb not null default '{}'::jsonb,
    "created_at" timestamptz not null default now(),
    constraint "member_merge_audit_distinct_users_check"
        check ("source_user_id" <> "target_user_id")
);

create index if not exists "member_merge_audit_source_user_id_idx"
    on "public"."member_merge_audit" ("source_user_id");

create index if not exists "member_merge_audit_target_user_id_created_at_idx"
    on "public"."member_merge_audit" ("target_user_id", "created_at" desc);

alter table "public"."member_merge_audit" enable row level security;

drop policy if exists "Admins read member merge audit" on "public"."member_merge_audit";
create policy "Admins read member merge audit"
    on "public"."member_merge_audit"
    as permissive
    for select
    to authenticated
    using (
        exists (
            select 1
            from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    );

revoke all on table "public"."member_merge_audit" from "anon";
revoke all on table "public"."member_merge_audit" from "authenticated";
grant select on table "public"."member_merge_audit" to "authenticated";
grant all on table "public"."member_merge_audit" to "service_role";

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

revoke all on function "public"."merge_duplicate_member"(uuid, uuid, uuid, text) from public;
revoke all on function "public"."merge_duplicate_member"(uuid, uuid, uuid, text) from anon;
revoke all on function "public"."merge_duplicate_member"(uuid, uuid, uuid, text) from authenticated;
grant execute on function "public"."merge_duplicate_member"(uuid, uuid, uuid, text) to service_role;

commit;
