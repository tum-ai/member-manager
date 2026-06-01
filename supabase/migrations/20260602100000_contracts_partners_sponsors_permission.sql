begin;

insert into "public"."department_permissions" ("department", "permissions")
values ('Partners & Sponsors', '["contracts.admin"]'::jsonb)
on conflict ("department") do update
set
    "permissions" = (
        select jsonb_agg(distinct p.permission)
        from jsonb_array_elements_text(
            coalesce("department_permissions"."permissions", '[]'::jsonb) ||
            excluded."permissions"
        ) as p(permission)
    ),
    "updated_at" = now();

commit;
