-- Members can request admin-managed profile changes. Admins review and either
-- approve or reject those requests; approved changes are then applied by the
-- application server.

begin;

create table if not exists "public"."member_change_requests" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "status" text not null default 'pending',
    "changes" jsonb not null,
    "reason" text,
    "review_note" text,
    "reviewed_by" uuid references "auth"."users"("id"),
    "reviewed_at" timestamptz,
    "created_at" timestamptz not null default now(),
    constraint "member_change_requests_status_check"
        check ("status" in ('pending', 'approved', 'rejected')),
    constraint "member_change_requests_changes_check"
        check (jsonb_typeof("changes") = 'object'),
    constraint "member_change_requests_review_state_check"
        check (
            ("status" = 'pending' and "reviewed_by" is null and "reviewed_at" is null)
            or ("status" in ('approved', 'rejected'))
        )
);

create index if not exists "member_change_requests_user_id_created_at_idx"
    on "public"."member_change_requests" ("user_id", "created_at" desc);

create index if not exists "member_change_requests_status_created_at_idx"
    on "public"."member_change_requests" ("status", "created_at" desc);

alter table "public"."member_change_requests" enable row level security;

drop policy if exists "Admins manage member change requests" on "public"."member_change_requests";
create policy "Admins manage member change requests"
    on "public"."member_change_requests"
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

drop policy if exists "Members insert own change requests" on "public"."member_change_requests";
create policy "Members insert own change requests"
    on "public"."member_change_requests"
    as permissive
    for insert
    to authenticated
    with check ("user_id" = auth.uid());

drop policy if exists "Members read own change requests" on "public"."member_change_requests";
create policy "Members read own change requests"
    on "public"."member_change_requests"
    as permissive
    for select
    to authenticated
    using ("user_id" = auth.uid());

grant all on table "public"."member_change_requests" to "anon";
grant all on table "public"."member_change_requests" to "authenticated";
grant all on table "public"."member_change_requests" to "service_role";

commit;
