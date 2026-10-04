-- Split the Data Privacy Notice agreement into its three purposes.
--
-- The notice asks for consent to three separate purposes (website profile,
-- event photos, sharing data incl. the CV with partners), but until now one
-- boolean (`data_privacy_notice_agreed`) recorded all three at once. Consent
-- has to be given per purpose, and the partner CV export needs the partner
-- consent on its own, so each purpose gets its own column.
--
-- `data_privacy_notice_agreed` stays as the "all three granted" summary. A
-- trigger keeps both representations in sync, so existing writers that only
-- know the legacy column (the SEPA route, the seed, the member merge
-- functions in 20260707120000 and 20260804120000) keep working unchanged.
--
-- `consents_decided_at` is null until the member has made a decision. The
-- client uses it to send undecided members to the /welcome page once per
-- session.

alter table "public"."member_agreements"
    add column if not exists "website_profile_consent" boolean not null default false,
    add column if not exists "event_photos_consent" boolean not null default false,
    add column if not exists "partner_sharing_consent" boolean not null default false,
    add column if not exists "consents_decided_at" timestamptz;

comment on column "public"."member_agreements"."website_profile_consent" is
    'Consent to show name, photo, studies and TUM.ai role on the website (Data Privacy Notice).';
comment on column "public"."member_agreements"."event_photos_consent" is
    'Consent to publish event photos on the website and public channels (Data Privacy Notice).';
comment on column "public"."member_agreements"."partner_sharing_consent" is
    'Consent to share data incl. the CV with partners for recruiting (Data Privacy Notice). Gates the partner CV export.';
comment on column "public"."member_agreements"."consents_decided_at" is
    'When the member last saved a consent decision; null = never decided.';
comment on column "public"."member_agreements"."data_privacy_notice_agreed" is
    'True when all three Data Privacy Notice purposes are granted. Kept in sync by sync_member_agreement_consents().';

-- Everyone who agreed to the bundled notice agreed to every purpose in it.
-- Everyone else stays undecided: the old `false` was the column default, not
-- a recorded refusal. Runs before the trigger exists so it can't interfere.
update "public"."member_agreements"
set
    "website_profile_consent" = true,
    "event_photos_consent" = true,
    "partner_sharing_consent" = true,
    "consents_decided_at" = "updated_at"
where "data_privacy_notice_agreed";

create or replace function "public"."sync_member_agreement_consents"()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    purposes_changed boolean;
    legacy_changed boolean;
begin
    if tg_op = 'INSERT' then
        purposes_changed := new.website_profile_consent
            or new.event_photos_consent
            or new.partner_sharing_consent;
        legacy_changed := new.data_privacy_notice_agreed;
    else
        purposes_changed :=
            new.website_profile_consent is distinct from old.website_profile_consent
            or new.event_photos_consent is distinct from old.event_photos_consent
            or new.partner_sharing_consent is distinct from old.partner_sharing_consent;
        legacy_changed :=
            new.data_privacy_notice_agreed is distinct from old.data_privacy_notice_agreed;
    end if;

    if purposes_changed then
        -- A per-purpose writer (PUT /api/members/:userId/consents) wins; the
        -- summary follows it.
        new.data_privacy_notice_agreed := new.website_profile_consent
            and new.event_photos_consent
            and new.partner_sharing_consent;
    elsif legacy_changed then
        -- A legacy writer accepted or revoked the whole notice.
        new.website_profile_consent := new.data_privacy_notice_agreed;
        new.event_photos_consent := new.data_privacy_notice_agreed;
        new.partner_sharing_consent := new.data_privacy_notice_agreed;
        if new.data_privacy_notice_agreed then
            new.consents_decided_at := coalesce(new.consents_decided_at, now());
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists "sync_member_agreement_consents" on "public"."member_agreements";
create trigger "sync_member_agreement_consents"
    before insert or update on "public"."member_agreements"
    for each row
    execute function "public"."sync_member_agreement_consents"();

-- Re-define merge_duplicate_member (last defined in 20260804120000) so a
-- merge carries the per-purpose consents and the decision timestamp over.
-- Everything except the member_agreements step is unchanged.
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

    -- Consents are a per-person decision, so the two accounts' Data Privacy
    -- Notice purposes are not OR-ed (that could re-grant a purpose the member
    -- withdrew on one account). The more recent decision wins as a whole; an
    -- undecided account never overrides a decided one. The summary column is
    -- left to sync_member_agreement_consents, which derives it from the
    -- winning purposes.
    insert into public.member_agreements (
        user_id,
        sepa_mandate_agreed,
        privacy_policy_agreed,
        data_privacy_notice_agreed,
        website_profile_consent,
        event_photos_consent,
        partner_sharing_consent,
        consents_decided_at,
        created_at,
        updated_at
    )
    select
        p_target_user_id,
        sepa_mandate_agreed,
        privacy_policy_agreed,
        data_privacy_notice_agreed,
        website_profile_consent,
        event_photos_consent,
        partner_sharing_consent,
        consents_decided_at,
        created_at,
        now()
    from public.member_agreements
    where user_id = p_source_user_id
    on conflict (user_id) do update set
        sepa_mandate_agreed = public.member_agreements.sepa_mandate_agreed
            or excluded.sepa_mandate_agreed,
        privacy_policy_agreed = public.member_agreements.privacy_policy_agreed
            or excluded.privacy_policy_agreed,
        website_profile_consent = case
            when excluded.consents_decided_at > coalesce(
                public.member_agreements.consents_decided_at, '-infinity'
            ) then excluded.website_profile_consent
            else public.member_agreements.website_profile_consent
        end,
        event_photos_consent = case
            when excluded.consents_decided_at > coalesce(
                public.member_agreements.consents_decided_at, '-infinity'
            ) then excluded.event_photos_consent
            else public.member_agreements.event_photos_consent
        end,
        partner_sharing_consent = case
            when excluded.consents_decided_at > coalesce(
                public.member_agreements.consents_decided_at, '-infinity'
            ) then excluded.partner_sharing_consent
            else public.member_agreements.partner_sharing_consent
        end,
        consents_decided_at = greatest(
            public.member_agreements.consents_decided_at,
            excluded.consents_decided_at
        ),
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
