begin;

-- Create tumai_days table
create table if not exists "public"."tumai_days" (
    "id" uuid primary key default gen_random_uuid(),
    "agenda" text not null,
    "scheduled_at" timestamptz not null,
    "sent_at" timestamptz,
    "created_at" timestamptz not null default now()
);

-- Create index for faster querying of scheduled/sent events
create index if not exists "tumai_days_scheduled_at_sent_at_idx"
    on "public"."tumai_days" ("scheduled_at", "sent_at");

-- Create tumai_day_responses table
create table if not exists "public"."tumai_day_responses" (
    "id" uuid primary key default gen_random_uuid(),
    "tumai_day_id" uuid not null references "public"."tumai_days"("id") on delete cascade,
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "status" text not null check ("status" in ('yes', 'no')),
    "reason" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "tumai_day_responses_unique" unique ("tumai_day_id", "user_id")
);

-- Enable RLS
alter table "public"."tumai_days" enable row level security;
alter table "public"."tumai_day_responses" enable row level security;

-- Helper security definer function to check if caller is admin or active community department member
create or replace function public.is_community_or_admin()
returns boolean
security definer
stable
language plpgsql
as $$
begin
  return (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    ) or
    exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.department = 'Community' and m.active = true
    )
  );
end;
$$;

-- RLS policies for tumai_days
drop policy if exists "Authenticated read tumai_days" on "public"."tumai_days";
create policy "Authenticated read tumai_days"
    on "public"."tumai_days"
    as permissive
    for select
    to authenticated
    using (true);

drop policy if exists "Admins/Community manage tumai_days" on "public"."tumai_days";
create policy "Admins/Community manage tumai_days"
    on "public"."tumai_days"
    as permissive
    for all
    to authenticated
    using (public.is_community_or_admin())
    with check (public.is_community_or_admin());

-- RLS policies for tumai_day_responses
drop policy if exists "Admins/Community read/manage all responses" on "public"."tumai_day_responses";
create policy "Admins/Community read/manage all responses"
    on "public"."tumai_day_responses"
    as permissive
    for all
    to authenticated
    using (public.is_community_or_admin())
    with check (public.is_community_or_admin());

drop policy if exists "Members manage own responses" on "public"."tumai_day_responses";
create policy "Members manage own responses"
    on "public"."tumai_day_responses"
    as permissive
    for all
    to authenticated
    using ("user_id" = auth.uid())
    with check ("user_id" = auth.uid());

-- Revoke public access, grant authenticated/service_role
revoke all on table "public"."tumai_days" from "anon";
grant select on table "public"."tumai_days" to "authenticated";
grant all on table "public"."tumai_days" to "service_role";

revoke all on table "public"."tumai_day_responses" from "anon";
grant select, insert, update, delete on table "public"."tumai_day_responses" to "authenticated";
grant all on table "public"."tumai_day_responses" to "service_role";

-- Seed department permission for Community
insert into "public"."department_permissions" ("department", "permissions")
values ('Community', '["tumai_days.manage"]'::jsonb)
on conflict ("department") do update
set permissions = case 
  when department_permissions.permissions ? 'tumai_days.manage' then department_permissions.permissions
  else department_permissions.permissions || '["tumai_days.manage"]'::jsonb
end;

commit;
