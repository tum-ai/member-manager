-- Split member status from member role.
-- `member_status` becomes the canonical lifecycle field (`active`, `inactive`,
-- `alumni`) while `member_role` returns to the canonical TUM.ai role set.
-- The legacy boolean `active` remains for compatibility and is derived from
-- `member_status`.

begin;

alter table "public"."members"
    add column if not exists "member_status" "text";

-- Legacy schema encoded both "inactive" and "alumni" as active=false plus
-- member_role='Alumni'. We no longer have enough information to split those
-- historical rows, so the safest automatic backfill is to map them to alumni.
update "public"."members"
set "member_status" = case
    when "member_status" in ('active', 'inactive', 'alumni') then "member_status"
    when coalesce("active", true) = false or "member_role" = 'Alumni' then 'alumni'
    else 'active'
end;

-- Normalize current roles back to the canonical non-status values.
update "public"."members"
set "member_role" = 'Member'
where "member_role" is null
   or "member_role" = 'Alumni'
   or "member_role" not in ('Member', 'Team Lead', 'Vice-President', 'President');

update "public"."members"
set "active" = ("member_status" = 'active');

alter table "public"."members"
    alter column "member_role" set default 'Member',
    alter column "member_role" set not null,
    alter column "member_status" set default 'active',
    alter column "member_status" set not null;

drop trigger if exists "sync_member_role_active" on "public"."members";
drop function if exists "public"."sync_member_role_active"();

alter table "public"."members"
    drop constraint if exists "members_member_role_check",
    drop constraint if exists "members_member_status_check",
    drop constraint if exists "members_member_status_active_check";

alter table "public"."members"
    add constraint "members_member_role_check"
        check ("member_role" in ('Member', 'Team Lead', 'Vice-President', 'President')),
    add constraint "members_member_status_check"
        check ("member_status" in ('active', 'inactive', 'alumni')),
    add constraint "members_member_status_active_check"
        check (
            ("member_status" = 'active' and "active" = true)
            or ("member_status" in ('inactive', 'alumni') and "active" = false)
        );

create or replace function "public"."sync_member_status_active"()
returns trigger
language plpgsql
as $$
begin
    if new."member_status" is null or btrim(new."member_status") = '' then
        if tg_op = 'UPDATE' then
            new."member_status" := old."member_status";
        elsif coalesce(new."active", true) = true then
            new."member_status" := 'active';
        else
            new."member_status" := 'inactive';
        end if;
    end if;

    if tg_op = 'UPDATE'
       and new."member_status" is not distinct from old."member_status"
       and new."active" is distinct from old."active" then
        if new."active" = true then
            new."member_status" := 'active';
        elsif old."member_status" = 'alumni' then
            new."member_status" := 'alumni';
        else
            new."member_status" := 'inactive';
        end if;
    end if;

    new."active" := (new."member_status" = 'active');
    return new;
end;
$$;

drop trigger if exists "sync_member_status_active" on "public"."members";

create trigger "sync_member_status_active"
before insert or update on "public"."members"
for each row execute function "public"."sync_member_status_active"();

create index if not exists "members_member_status_idx"
    on "public"."members" ("member_status");

commit;
