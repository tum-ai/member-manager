-- Members can submit job postings for admin review. Approved requests become
-- visible on the member job board; pending and rejected requests stay private
-- to the submitter and admins.

begin;

create table if not exists "public"."job_posting_requests" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "status" text not null default 'pending',
    "title" text not null,
    "organization_name" text not null,
    "logo_url" text,
    "description_markdown" text not null,
    "call_to_action" text not null default 'Apply now',
    "job_type" text not null,
    "location" text not null,
    "contact_name" text not null,
    "contact_email" text not null,
    "contact_role" text,
    "external_url" text,
    "expires_at" timestamptz,
    "published_at" timestamptz,
    "review_note" text,
    "reviewed_by" uuid references "auth"."users"("id"),
    "reviewed_at" timestamptz,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "job_posting_requests_status_check"
        check ("status" in ('pending', 'approved', 'rejected')),
    constraint "job_posting_requests_job_type_check"
        check ("job_type" in ('internship', 'working_student', 'full_time', 'thesis', 'other')),
    constraint "job_posting_requests_review_state_check"
        check (
            ("status" = 'pending' and "reviewed_by" is null and "reviewed_at" is null and "published_at" is null)
            or (
                "status" = 'approved'
                and "reviewed_by" is not null
                and "reviewed_at" is not null
                and "published_at" is not null
            )
            or (
                "status" = 'rejected'
                and "reviewed_by" is not null
                and "reviewed_at" is not null
                and "published_at" is null
            )
        )
);

create index if not exists "job_posting_requests_user_id_created_at_idx"
    on "public"."job_posting_requests" ("user_id", "created_at" desc);

create index if not exists "job_posting_requests_status_published_at_idx"
    on "public"."job_posting_requests" ("status", "published_at" desc);

alter table "public"."job_posting_requests" enable row level security;

drop policy if exists "Admins manage job posting requests" on "public"."job_posting_requests";
create policy "Admins manage job posting requests"
    on "public"."job_posting_requests"
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

drop policy if exists "Members insert own job posting requests" on "public"."job_posting_requests";
create policy "Members insert own job posting requests"
    on "public"."job_posting_requests"
    as permissive
    for insert
    to authenticated
    with check (
        "user_id" = auth.uid()
        and "status" = 'pending'
        and "review_note" is null
        and "reviewed_by" is null
        and "reviewed_at" is null
        and "published_at" is null
        and exists (
            select 1
            from "public"."members" m
            where m.user_id = auth.uid()
                and coalesce(m.member_status, case when m.active then 'active' else 'inactive' end) = 'active'
        )
    );

drop policy if exists "Members read own job posting requests" on "public"."job_posting_requests";
create policy "Members read own job posting requests"
    on "public"."job_posting_requests"
    as permissive
    for select
    to authenticated
    using ("user_id" = auth.uid());

drop policy if exists "Active members read approved job postings" on "public"."job_posting_requests";
create policy "Active members read approved job postings"
    on "public"."job_posting_requests"
    as permissive
    for select
    to authenticated
    using (
        "status" = 'approved'
        and ("expires_at" is null or "expires_at" >= now())
        and exists (
            select 1
            from "public"."members" m
            where m.user_id = auth.uid()
                and coalesce(m.member_status, case when m.active then 'active' else 'inactive' end) = 'active'
        )
    );

revoke all on table "public"."job_posting_requests" from "anon";
revoke all on table "public"."job_posting_requests" from "authenticated";
grant select on table "public"."job_posting_requests" to "authenticated";
grant all on table "public"."job_posting_requests" to "service_role";

commit;
