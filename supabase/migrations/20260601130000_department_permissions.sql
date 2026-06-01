-- Department-scoped tool access. Each department maps to the set of tool
-- permissions every active member of that department inherits. Admins manage
-- this mapping through the admin UI; the application server reads it to gate
-- access. Authenticated users may read it so the client can show/hide tools.

begin;

create table if not exists "public"."department_permissions" (
    "department" text primary key,
    "permissions" jsonb not null default '[]'::jsonb,
    "updated_at" timestamptz not null default now(),
    "updated_by" uuid references "auth"."users"("id"),
    constraint "department_permissions_permissions_check"
        check (jsonb_typeof("permissions") = 'array')
);

alter table "public"."department_permissions" enable row level security;

drop policy if exists "Authenticated read department permissions" on "public"."department_permissions";
create policy "Authenticated read department permissions"
    on "public"."department_permissions"
    as permissive
    for select
    to authenticated
    using (true);

drop policy if exists "Admins manage department permissions" on "public"."department_permissions";
create policy "Admins manage department permissions"
    on "public"."department_permissions"
    as permissive
    for all
    to authenticated
    using (
        exists (
            select 1
            from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    )
    with check (
        exists (
            select 1
            from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    );

revoke all on table "public"."department_permissions" from "anon";
grant select on table "public"."department_permissions" to "authenticated";
grant all on table "public"."department_permissions" to "service_role";

-- Seed the current mapping: Legal & Finance owns Finance Review and the
-- contract generator. Other departments start with no special tool access.
insert into "public"."department_permissions" ("department", "permissions")
values ('Legal & Finance', '["finance.review", "contracts.admin"]'::jsonb)
on conflict ("department") do nothing;

commit;
