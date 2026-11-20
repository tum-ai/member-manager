-- Versioned, transactional profile saves.
--
-- The profile page used to save with two independent requests (member row,
-- then bank details) and last-write-wins semantics: one could succeed while
-- the other failed, and a stale form silently overwrote newer data.
--
-- - `members.version` is an opaque, strictly increasing profile version. The
--   API hands it out on read and requires it back on write (HTTP `If-Match`
--   style optimistic concurrency).
-- - Every update of the member row bumps it, and so does every write to the
--   member's `sepa` and `member_agreements` rows (they are part of the profile
--   a form shows), so no writer can be silently overwritten by a stale form.
-- - `public.save_member_profile()` writes the member row, the bank details and
--   the agreements in one transaction and rejects a stale version with
--   SQLSTATE 40001, which the API maps to 412. It only receives ciphertext for
--   sensitive columns: encryption stays in the API.

alter table "public"."members"
    add column if not exists "version" bigint not null default 1;

comment on column "public"."members"."version" is
    'Opaque profile version for optimistic concurrency. Bumped by every write to the member, sepa and member_agreements rows of this member.';

create or replace function "public"."bump_member_version"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new."version" := old."version" + 1;
    return new;
end;
$$;

drop trigger if exists "bump_member_version" on "public"."members";
create trigger "bump_member_version"
before update on "public"."members"
for each row execute function "public"."bump_member_version"();

-- Writes to the profile's satellite rows count as a profile change.
create or replace function "public"."touch_member_version"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update "public"."members"
    set "version" = "version"
    where "user_id" = new."user_id";
    return new;
end;
$$;

drop trigger if exists "touch_member_version" on "public"."sepa";
create trigger "touch_member_version"
after insert or update on "public"."sepa"
for each row execute function "public"."touch_member_version"();

drop trigger if exists "touch_member_version" on "public"."member_agreements";
create trigger "touch_member_version"
after insert or update on "public"."member_agreements"
for each row execute function "public"."touch_member_version"();

revoke all on function "public"."bump_member_version"() from public, anon, authenticated;
revoke all on function "public"."touch_member_version"() from public, anon, authenticated;

-- p_member:     partial member columns (keys present are written, absent keys
--               stay as stored, JSON null clears). Whitelisted below.
-- p_sepa:       bank details to upsert, or null to leave the sepa row alone.
-- p_agreements: {sepa_mandate_agreed, privacy_policy_agreed,
--               data_privacy_notice_agreed?}; the last key is only written when
--               present (writing it grants or revokes all three purposes).
-- p_expected_version = 0 creates the member row (first profile save).
-- Returns the new profile version.
create or replace function "public"."save_member_profile"(
    p_user_id uuid,
    p_expected_version bigint,
    p_member jsonb,
    p_sepa jsonb,
    p_agreements jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_expected bigint := p_expected_version;
    v_rows integer;
    v_version bigint;
begin
    if p_expected_version = 0 then
        -- NOT NULL columns without a default get a blank placeholder; the
        -- update below fills in everything the caller sent.
        insert into "public"."members" (
            "user_id", "given_name", "surname", "date_of_birth", "street",
            "number", "postal_code", "city", "country", "version"
        )
        values (p_user_id, '', '', '', '', '', '', '', '', 1)
        on conflict ("user_id") do nothing;
        get diagnostics v_rows = row_count;
        if v_rows = 0 then
            raise exception 'profile version conflict' using errcode = '40001';
        end if;
        v_expected := 1;
    end if;

    update "public"."members" m
    set
        "given_name" = case when p_member ? 'given_name' then p_member->>'given_name' else m."given_name" end,
        "surname" = case when p_member ? 'surname' then p_member->>'surname' else m."surname" end,
        "date_of_birth" = case when p_member ? 'date_of_birth' then p_member->>'date_of_birth' else m."date_of_birth" end,
        "street" = case when p_member ? 'street' then p_member->>'street' else m."street" end,
        "number" = case when p_member ? 'number' then p_member->>'number' else m."number" end,
        "postal_code" = case when p_member ? 'postal_code' then p_member->>'postal_code' else m."postal_code" end,
        "city" = case when p_member ? 'city' then p_member->>'city' else m."city" end,
        "country" = case when p_member ? 'country' then p_member->>'country' else m."country" end,
        "salutation" = case when p_member ? 'salutation' then p_member->>'salutation' else m."salutation" end,
        "title" = case when p_member ? 'title' then p_member->>'title' else m."title" end,
        "batch" = case when p_member ? 'batch' then p_member->>'batch' else m."batch" end,
        "department" = case when p_member ? 'department' then p_member->>'department' else m."department" end,
        "member_role" = case when p_member ? 'member_role' then p_member->>'member_role' else m."member_role" end,
        "degree" = case when p_member ? 'degree' then p_member->>'degree' else m."degree" end,
        "school" = case when p_member ? 'school' then p_member->>'school' else m."school" end,
        "research_project_id" = case when p_member ? 'research_project_id' then p_member->>'research_project_id' else m."research_project_id" end,
        "reimbursement_slack_notifications_enabled" = case
            when p_member ? 'reimbursement_slack_notifications_enabled'
                then (p_member->>'reimbursement_slack_notifications_enabled')::boolean
            else m."reimbursement_slack_notifications_enabled" end,
        "linkedin_profile_url" = case when p_member ? 'linkedin_profile_url' then p_member->>'linkedin_profile_url' else m."linkedin_profile_url" end,
        "public_location" = case when p_member ? 'public_location' then p_member->>'public_location' else m."public_location" end
    where m."user_id" = p_user_id
        and m."version" = v_expected;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
        raise exception 'profile version conflict' using errcode = '40001';
    end if;

    if p_sepa is not null then
        insert into "public"."sepa" (
            "user_id", "iban", "bic", "bank_name", "mandate_agreed", "privacy_agreed"
        )
        values (
            p_user_id,
            p_sepa->>'iban',
            p_sepa->>'bic',
            coalesce(p_sepa->>'bank_name', ''),
            coalesce((p_sepa->>'mandate_agreed')::boolean, false),
            coalesce((p_sepa->>'privacy_agreed')::boolean, false)
        )
        on conflict ("user_id") do update set
            "iban" = excluded."iban",
            "bic" = excluded."bic",
            "bank_name" = excluded."bank_name",
            "mandate_agreed" = excluded."mandate_agreed",
            "privacy_agreed" = excluded."privacy_agreed";
    end if;

    if p_agreements is not null then
        insert into "public"."member_agreements" (
            "user_id", "sepa_mandate_agreed", "privacy_policy_agreed",
            "data_privacy_notice_agreed", "updated_at"
        )
        values (
            p_user_id,
            coalesce((p_agreements->>'sepa_mandate_agreed')::boolean, false),
            coalesce((p_agreements->>'privacy_policy_agreed')::boolean, false),
            coalesce((p_agreements->>'data_privacy_notice_agreed')::boolean, false),
            now()
        )
        on conflict ("user_id") do update set
            "sepa_mandate_agreed" = excluded."sepa_mandate_agreed",
            "privacy_policy_agreed" = excluded."privacy_policy_agreed",
            "data_privacy_notice_agreed" = case
                when p_agreements ? 'data_privacy_notice_agreed'
                    then excluded."data_privacy_notice_agreed"
                else "public"."member_agreements"."data_privacy_notice_agreed" end,
            "updated_at" = excluded."updated_at";
    end if;

    select m."version" into v_version
    from "public"."members" m
    where m."user_id" = p_user_id;
    return v_version;
end;
$$;

comment on function "public"."save_member_profile"(uuid, bigint, jsonb, jsonb, jsonb) is
    'Atomic profile save (member row, bank details, agreements) with optimistic concurrency. Raises 40001 on a stale p_expected_version. Called by the API with the service role only.';

revoke all on function "public"."save_member_profile"(uuid, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function "public"."save_member_profile"(uuid, bigint, jsonb, jsonb, jsonb) to service_role;
