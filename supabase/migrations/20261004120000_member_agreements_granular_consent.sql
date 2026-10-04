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
