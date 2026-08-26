begin;

-- The member-merge RPC is defined by the main branch's member-merge migration.
-- Rename that implementation and keep its existing behavior behind a wrapper so
-- this Beacon migration can move Beacon-owned rows before the source member is
-- deleted. The wrapper is intentionally service-role-only, matching the
-- existing admin route's server-mediated access boundary. The guard keeps a
-- Beacon-only checkout replayable; the base function appears when this file is
-- replayed after the main branch's member-merge migrations.
do $$
begin
    if to_regprocedure('public.merge_duplicate_member(uuid,uuid,uuid,text)') is not null
       and to_regprocedure('public.merge_duplicate_member_without_beacon(uuid,uuid,uuid,text)') is null then
        execute 'alter function public.merge_duplicate_member(uuid, uuid, uuid, text) rename to merge_duplicate_member_without_beacon';
    end if;
    if to_regprocedure('public.merge_duplicate_member_without_beacon(uuid,uuid,uuid,text)') is not null then
        execute format(
            'alter function public.merge_duplicate_member_without_beacon(uuid, uuid, uuid, text) set search_path = %L',
            ''
        );
    end if;
end;
$$;

create schema if not exists "private";
revoke all on schema "private" from public, anon, authenticated;

-- Merge Beacon state and claim edges before the source members row is removed.
-- Target claims win on a collision, except a pending target claim yields to a
-- confirmed/rejected source decision. Nullable target fields are filled from
-- the source; explicit member decisions are never replaced by pending data.
create or replace function "private"."merge_beacon_member_data"(
    "p_source_user_id" uuid,
    "p_target_user_id" uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_counts jsonb := '{}'::jsonb;
    v_count integer;
begin
    -- One Beacon profile row per member. Opting out is monotonic across a
    -- merge: either member's opt-out decision hides the resulting profile.
    insert into public.beacon_person (
        user_id,
        headline,
        summary,
        consent_at,
        opted_out,
        last_enriched_at,
        created_at,
        updated_at
    )
    select
        p_target_user_id,
        source_person.headline,
        source_person.summary,
        source_person.consent_at,
        source_person.opted_out,
        source_person.last_enriched_at,
        source_person.created_at,
        now()
    from public.beacon_person source_person
    where source_person.user_id = p_source_user_id
    on conflict (user_id) do update set
        headline = coalesce(nullif(public.beacon_person.headline, ''), excluded.headline),
        summary = coalesce(nullif(public.beacon_person.summary, ''), excluded.summary),
        consent_at = coalesce(public.beacon_person.consent_at, excluded.consent_at),
        opted_out = public.beacon_person.opted_out or excluded.opted_out,
        last_enriched_at = case
            when public.beacon_person.last_enriched_at is null then excluded.last_enriched_at
            when excluded.last_enriched_at is null then public.beacon_person.last_enriched_at
            else greatest(public.beacon_person.last_enriched_at, excluded.last_enriched_at)
        end,
        updated_at = now();
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person', v_count);

    -- Employment has a partial dedup key (resolved organization + title).
    update public.beacon_employment target_claim
    set
        title = coalesce(target_claim.title, source_claim.title),
        start_year = coalesce(target_claim.start_year, source_claim.start_year),
        end_year = coalesce(target_claim.end_year, source_claim.end_year),
        source_id = coalesce(target_claim.source_id, source_claim.source_id),
        raw_value = coalesce(target_claim.raw_value, source_claim.raw_value),
        confidence = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.confidence
            else target_claim.confidence
        end,
        status = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.status
            else target_claim.status
        end,
        updated_at = now()
    from public.beacon_employment source_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.organization_id is not null
      and source_claim.organization_id = target_claim.organization_id
      and coalesce(source_claim.title, '') = coalesce(target_claim.title, '');

    delete from public.beacon_employment source_claim
    using public.beacon_employment target_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.organization_id is not null
      and source_claim.organization_id = target_claim.organization_id
      and coalesce(source_claim.title, '') = coalesce(target_claim.title, '');
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_employment_deduped', v_count);

    update public.beacon_employment
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_employment', v_count);

    -- Education has the same partial dedup shape (resolved school + degree).
    update public.beacon_education target_claim
    set
        degree = coalesce(target_claim.degree, source_claim.degree),
        field = coalesce(target_claim.field, source_claim.field),
        start_year = coalesce(target_claim.start_year, source_claim.start_year),
        end_year = coalesce(target_claim.end_year, source_claim.end_year),
        source_id = coalesce(target_claim.source_id, source_claim.source_id),
        raw_value = coalesce(target_claim.raw_value, source_claim.raw_value),
        confidence = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.confidence
            else target_claim.confidence
        end,
        status = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.status
            else target_claim.status
        end,
        updated_at = now()
    from public.beacon_education source_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.school_id is not null
      and source_claim.school_id = target_claim.school_id
      and coalesce(source_claim.degree, '') = coalesce(target_claim.degree, '');

    delete from public.beacon_education source_claim
    using public.beacon_education target_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.school_id is not null
      and source_claim.school_id = target_claim.school_id
      and coalesce(source_claim.degree, '') = coalesce(target_claim.degree, '');
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_education_deduped', v_count);

    update public.beacon_education
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_education', v_count);

    -- The remaining claim edges have unconditional per-member unique keys.
    update public.beacon_person_skill target_claim
    set
        proficiency = coalesce(target_claim.proficiency, source_claim.proficiency),
        source_id = coalesce(target_claim.source_id, source_claim.source_id),
        raw_value = coalesce(target_claim.raw_value, source_claim.raw_value),
        confidence = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.confidence
            else target_claim.confidence
        end,
        status = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.status
            else target_claim.status
        end,
        updated_at = now()
    from public.beacon_person_skill source_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.skill_id = target_claim.skill_id;

    delete from public.beacon_person_skill source_claim
    using public.beacon_person_skill target_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.skill_id = target_claim.skill_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_skill_deduped', v_count);

    update public.beacon_person_skill
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_skill', v_count);

    update public.beacon_person_project target_claim
    set
        role = coalesce(target_claim.role, source_claim.role),
        source_id = coalesce(target_claim.source_id, source_claim.source_id),
        raw_value = coalesce(target_claim.raw_value, source_claim.raw_value),
        confidence = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.confidence
            else target_claim.confidence
        end,
        status = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.status
            else target_claim.status
        end,
        updated_at = now()
    from public.beacon_person_project source_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.project_id = target_claim.project_id;

    delete from public.beacon_person_project source_claim
    using public.beacon_person_project target_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.project_id = target_claim.project_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_project_deduped', v_count);

    update public.beacon_person_project
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_project', v_count);

    update public.beacon_person_tag target_claim
    set
        source_id = coalesce(target_claim.source_id, source_claim.source_id),
        raw_value = coalesce(target_claim.raw_value, source_claim.raw_value),
        confidence = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.confidence
            else target_claim.confidence
        end,
        status = case
            when target_claim.status = 'pending' and source_claim.status in ('confirmed', 'rejected')
                then source_claim.status
            else target_claim.status
        end,
        updated_at = now()
    from public.beacon_person_tag source_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.tag = target_claim.tag;

    delete from public.beacon_person_tag source_claim
    using public.beacon_person_tag target_claim
    where source_claim.user_id = p_source_user_id
      and target_claim.user_id = p_target_user_id
      and source_claim.tag = target_claim.tag;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_tag_deduped', v_count);

    update public.beacon_person_tag
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_tag', v_count);

    -- Logs remain attributable to the merged member. Search chunks are derived
    -- data; purge both sides so a later rebuild cannot retain stale ownership.
    update public.beacon_search_log
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_search_log', v_count);

    update public.beacon_agent_log
    set user_id = p_target_user_id
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_agent_log', v_count);

    delete from public.beacon_search_chunk
    where user_id in (p_source_user_id, p_target_user_id);
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_search_chunk', v_count);

    delete from public.beacon_person
    where user_id = p_source_user_id;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('beacon_person_source', v_count);

    return v_counts;
end;
$$;

revoke all on function "private"."merge_beacon_member_data"(uuid, uuid)
    from public, anon, authenticated, service_role;

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
set search_path = ''
as $$
declare
    v_result record;
    v_beacon_counts jsonb;
    v_counts jsonb;
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

    perform 1 from public.members where user_id = p_target_user_id for update;
    if not found then
        raise exception 'target member not found'
            using errcode = 'P0002';
    end if;

    perform 1 from public.members where user_id = p_source_user_id for update;
    if not found then
        raise exception 'source member not found'
            using errcode = 'P0002';
    end if;

    v_beacon_counts := private.merge_beacon_member_data(
        p_source_user_id,
        p_target_user_id
    );

    select merged.*
    into v_result
    from public.merge_duplicate_member_without_beacon(
        p_source_user_id,
        p_target_user_id,
        p_admin_user_id,
        p_note
    ) as merged;

    v_counts := coalesce(v_result.transferred_counts, '{}'::jsonb)
        || coalesce(v_beacon_counts, '{}'::jsonb);

    update public.member_merge_audit
    set transferred_counts = v_counts
    where id = v_result.audit_id;

    return query
    select p_source_user_id, p_target_user_id, v_result.audit_id, v_counts;
end;
$$;

do $$
begin
    if to_regprocedure('public.merge_duplicate_member_without_beacon(uuid,uuid,uuid,text)') is not null then
        execute 'revoke all on function public.merge_duplicate_member_without_beacon(uuid, uuid, uuid, text) from public, anon, authenticated, service_role';
        execute 'grant execute on function public.merge_duplicate_member_without_beacon(uuid, uuid, uuid, text) to service_role';
    end if;
    execute 'revoke all on function public.merge_duplicate_member(uuid, uuid, uuid, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.merge_duplicate_member(uuid, uuid, uuid, text) to service_role';
end;
$$;

commit;
