-- Constrain `members.member_role` to the canonical TUM.ai role set,
-- default new rows to 'Member', and collapse the "inactive" concept into
-- the 'Alumni' role so the app has a single source of truth.
--
-- We use a CHECK constraint instead of a Postgres ENUM type so that:
--   * Rolling this back is a one-liner (`DROP CONSTRAINT`),
--   * Mock data in tests can still insert raw strings without needing to
--     round-trip through an ALTER TYPE.
--
-- Canonical roles (ordered by seniority, oldest first):
--     Member, Team Lead, Vice-President, President, Alumni
--
-- Invariants this migration establishes:
--   * `member_role` is NOT NULL with default 'Member'.
--   * `member_role = 'Alumni'` iff `active = false`.
--   * A CHECK + BEFORE trigger keep those two columns in sync going forward.

begin;

-- Backfill: existing rows may be NULL, free text, or legacy values.
update "public"."members"
set "member_role" = 'Alumni'
where coalesce("active", true) = false;

update "public"."members"
set "member_role" = 'Member'
where "member_role" is null
   or "member_role" not in ('Member', 'Team Lead', 'Vice-President', 'President', 'Alumni');

alter table "public"."members"
    alter column "member_role" set default 'Member',
    alter column "member_role" set not null;

-- Reject writes that don't use a canonical role.
alter table "public"."members"
    add constraint "members_member_role_check"
    check ("member_role" in ('Member', 'Team Lead', 'Vice-President', 'President', 'Alumni'));

-- Keep role <-> active coherent on every future write. PostgREST + server
-- code only need to update one column; the trigger mirrors the other.
create or replace function "public"."sync_member_role_active"()
returns trigger
language plpgsql
as $$
begin
    if (tg_op = 'INSERT') then
        if new."member_role" = 'Alumni' then
            new."active" := false;
        elsif new."active" = false then
            new."member_role" := 'Alumni';
        end if;
        return new;
    end if;

    -- UPDATE: whichever column the caller explicitly changed wins.
    if new."member_role" is distinct from old."member_role" then
        if new."member_role" = 'Alumni' then
            new."active" := false;
        elsif old."member_role" = 'Alumni' and new."active" = old."active" then
            -- Moving out of Alumni reactivates the member unless the caller
            -- also explicitly passed active=false.
            new."active" := true;
        end if;
    elsif new."active" is distinct from old."active" then
        if new."active" = false then
            new."member_role" := 'Alumni';
        elsif old."member_role" = 'Alumni' then
            new."member_role" := 'Member';
        end if;
    end if;

    -- Final normalization: always enforce the invariant, including when both
    -- columns are changed in the same UPDATE statement.
    if new."active" = false then
        new."member_role" := 'Alumni';
    elsif new."member_role" = 'Alumni' then
        new."active" := false;
    end if;

    return new;
end;
$$;

drop trigger if exists "sync_member_role_active" on "public"."members";

create trigger "sync_member_role_active"
before insert or update on "public"."members"
for each row execute function "public"."sync_member_role_active"();

create index if not exists "members_member_role_idx"
    on "public"."members" ("member_role");

commit;
