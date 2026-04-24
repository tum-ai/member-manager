-- Engagement certificates now require admin approval before the member can
-- download the final PDF. Each request stores the submitted engagement blocks
-- plus the admin review metadata.

begin;

create table if not exists "public"."engagement_certificate_requests" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "status" text not null default 'pending',
    "engagements" jsonb not null,
    "review_note" text,
    "reviewed_by" uuid references "auth"."users"("id"),
    "reviewed_at" timestamptz,
    "created_at" timestamptz not null default now(),
    constraint "engagement_certificate_requests_status_check"
        check ("status" in ('pending', 'approved', 'rejected')),
    constraint "engagement_certificate_requests_engagements_check"
        check (jsonb_typeof("engagements") = 'array'),
    constraint "engagement_certificate_requests_review_state_check"
        check (
            ("status" = 'pending' and "reviewed_by" is null and "reviewed_at" is null)
            or ("status" in ('approved', 'rejected'))
        )
);

create index if not exists "engagement_certificate_requests_user_id_created_at_idx"
    on "public"."engagement_certificate_requests" ("user_id", "created_at" desc);

create index if not exists "engagement_certificate_requests_status_created_at_idx"
    on "public"."engagement_certificate_requests" ("status", "created_at" desc);

alter table "public"."engagement_certificate_requests" enable row level security;

drop policy if exists "Admins manage engagement certificate requests" on "public"."engagement_certificate_requests";
create policy "Admins manage engagement certificate requests"
    on "public"."engagement_certificate_requests"
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

drop policy if exists "Members insert own engagement certificate requests" on "public"."engagement_certificate_requests";
create policy "Members insert own engagement certificate requests"
    on "public"."engagement_certificate_requests"
    as permissive
    for insert
    to authenticated
    with check ("user_id" = auth.uid());

drop policy if exists "Members read own engagement certificate requests" on "public"."engagement_certificate_requests";
create policy "Members read own engagement certificate requests"
    on "public"."engagement_certificate_requests"
    as permissive
    for select
    to authenticated
    using ("user_id" = auth.uid());

grant all on table "public"."engagement_certificate_requests" to "anon";
grant all on table "public"."engagement_certificate_requests" to "authenticated";
grant all on table "public"."engagement_certificate_requests" to "service_role";

commit;
