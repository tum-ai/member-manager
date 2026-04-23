-- Member role history: admins can record past role assignments per semester.
-- Example: "Team Lead in WS25/26, now Alumni".
--
-- `ended_at` is NULL for the active role term, which means admins can use this
-- table to represent "currently a Team Lead since SS25" without duplicating the
-- current role in `members.member_role`. `members.member_role` remains the
-- authoritative snapshot of *now*; history rows are additional context.

begin;

create table if not exists "public"."member_role_history" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "role" text not null,
    "semester" text,
    "started_at" date,
    "ended_at" date,
    "note" text,
    "created_at" timestamptz not null default now(),
    "created_by" uuid,
    constraint "member_role_history_role_check"
        check ("role" in ('Member', 'Team Lead', 'Vice-President', 'President', 'Alumni')),
    constraint "member_role_history_dates_check"
        check ("ended_at" is null or "started_at" is null or "ended_at" >= "started_at")
);

create index if not exists "member_role_history_user_id_idx"
    on "public"."member_role_history" ("user_id");

alter table "public"."member_role_history" enable row level security;

-- Admins can do anything; regular users can read their own history.
drop policy if exists "Admins manage role history" on "public"."member_role_history";
create policy "Admins manage role history"
    on "public"."member_role_history"
    as permissive
    for all
    to authenticated
    using (
        exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    )
    with check (
        exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    );

drop policy if exists "Members read own role history" on "public"."member_role_history";
create policy "Members read own role history"
    on "public"."member_role_history"
    as permissive
    for select
    to authenticated
    using (user_id = auth.uid());

commit;
