-- Door PINs for the TUM.ai office key cabinet (Traka21).
--
-- Every member has at most one PIN. Admins import them from the cabinet's
-- user sheet (or set them one by one) and members see their own PIN on the
-- profile once they have saved a decision on /welcome. The cabinet stays the
-- source of truth; this table mirrors it so members can look their PIN up.
--
-- A PIN opens a physical door, so it is treated like bank details:
-- - the server encrypts it (`enc-v1:` ciphertext, SENSITIVE_DOOR_PIN_FIELDS
--   in server/src/lib/sensitiveData.ts) and the guard trigger below refuses
--   anything else;
-- - browsers have no access at all; reads and writes go through the API with
--   the service role.

create table if not exists "public"."member_door_pins" (
    "user_id" uuid primary key
        references "public"."members" ("user_id") on delete cascade,
    "pin" text not null check ("pin" <> ''),
    "updated_by" uuid references "auth"."users" ("id") on delete set null,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

comment on table "public"."member_door_pins" is
    'One Traka21 key-cabinet PIN per member, encrypted by the server. Service role only.';
comment on column "public"."member_door_pins"."pin" is
    'enc-v1: ciphertext of the PIN (4-10 digits). Enforced by private.enforce_encrypted_sensitive_fields().';
comment on column "public"."member_door_pins"."updated_by" is
    'Admin who last imported or set the PIN.';

alter table "public"."member_door_pins" enable row level security;

-- The default privileges grant every new table to anon and authenticated;
-- take that back so only the API (service role) can touch PINs.
revoke all on table "public"."member_door_pins"
    from public, anon, authenticated;
grant select, insert, update, delete
    on table "public"."member_door_pins"
    to service_role;

-- Re-define the encryption guard (last defined in 20260714120000) with a
-- branch for door PINs. The existing branches are unchanged.
create or replace function "private"."enforce_encrypted_sensitive_fields"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_table_name = 'members' then
        if not (
            private.is_encrypted_sensitive_value(new.date_of_birth)
            and private.is_encrypted_sensitive_value(new.street)
            and private.is_encrypted_sensitive_value(new.number)
            and private.is_encrypted_sensitive_value(new.postal_code)
            and private.is_encrypted_sensitive_value(new.city)
            and private.is_encrypted_sensitive_value(new.country)
            and private.is_encrypted_sensitive_value(new.phone)
        ) then
            raise check_violation using message = 'Sensitive member fields must be encrypted';
        end if;
    elsif tg_table_name = 'sepa' then
        if not (
            private.is_encrypted_sensitive_value(new.iban)
            and private.is_encrypted_sensitive_value(new.bic)
            and private.is_encrypted_sensitive_value(new.bank_name)
        ) then
            raise check_violation using message = 'Sensitive SEPA fields must be encrypted';
        end if;
    elsif tg_table_name = 'reimbursements' then
        if not (
            private.is_encrypted_sensitive_value(new.payment_iban)
            and private.is_encrypted_sensitive_value(new.payment_bic)
        ) then
            raise check_violation using message = 'Sensitive reimbursement fields must be encrypted';
        end if;
    elsif tg_table_name = 'member_door_pins' then
        if not private.is_encrypted_sensitive_value(new.pin) then
            raise check_violation using message = 'Door PINs must be encrypted';
        end if;
    end if;

    return new;
end;
$$;

create trigger "enforce_member_door_pins_sensitive_insert"
before insert on "public"."member_door_pins"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

create trigger "enforce_member_door_pins_sensitive_update"
before update of "pin" on "public"."member_door_pins"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

-- Re-define merge_duplicate_member (last defined in 20261004120000) so a
-- merge keeps the door PIN: deleting the source member would otherwise
-- cascade-delete it. The target keeps its own PIN when it has one; otherwise
-- the source's moves over. PINs stay out of the audit snapshot. Everything
-- else is unchanged.
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
    v_target_has_door_pin boolean;
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

    -- One cabinet PIN per member: the target keeps its own, otherwise the
    -- source's PIN moves over before the source member is deleted below.
    select exists (
        select 1 from public.member_door_pins where user_id = p_target_user_id
    )
    into v_target_has_door_pin;

    if v_target_has_door_pin then
        delete from public.member_door_pins
        where user_id = p_source_user_id;
    else
        update public.member_door_pins
        set user_id = p_target_user_id, updated_at = now()
        where user_id = p_source_user_id;
    end if;

    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('member_door_pins', v_count);

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
