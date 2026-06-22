-- Fix Partners & Sponsors default permission: should be contracts.create (submit
-- contracts for L&F review), not contracts.admin (which allows approving/rejecting).
-- Migration 20260602100000 erroneously assigned contracts.admin to this department.
--
-- Surgically removes contracts.admin and adds contracts.create, preserving any
-- other permissions already on the row (e.g. ones added by admins after the
-- original migration ran).

begin;

update "public"."department_permissions"
set
    "permissions" = (
        select coalesce(jsonb_agg(elem), '[]'::jsonb)
        from jsonb_array_elements("permissions") as elem
        where elem::text != '"contracts.admin"'
    ) ||
    case
        when not "permissions" @> '["contracts.create"]'::jsonb
        then '["contracts.create"]'::jsonb
        else '[]'::jsonb
    end,
    "updated_at" = now()
where "department" = 'Partners & Sponsors';

-- Row may not exist yet in fresh environments; insert with a safe default.
insert into "public"."department_permissions" ("department", "permissions")
values ('Partners & Sponsors', '["contracts.create"]'::jsonb)
on conflict ("department") do nothing;

commit;
