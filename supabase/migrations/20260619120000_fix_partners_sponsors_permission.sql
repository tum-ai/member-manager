-- Fix Partners & Sponsors default permission: should be contracts.create (submit
-- contracts for L&F review), not contracts.admin (which allows approving/rejecting).
-- Migration 20260602100000 erroneously assigned contracts.admin to this department.

begin;

insert into "public"."department_permissions" ("department", "permissions")
values ('Partners & Sponsors', '["contracts.create"]'::jsonb)
on conflict ("department") do update
set
    "permissions" = '["contracts.create"]'::jsonb,
    "updated_at" = now();

commit;
