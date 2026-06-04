begin;

create table if not exists "public"."contract_partner_comments" (
    "id" uuid primary key default gen_random_uuid(),
    "submission_id" uuid not null references "public"."contract_submissions"("id") on delete cascade,
    "author_type" text not null,
    "author_name" text,
    "author_email" text,
    "comment" text not null,
    "document_version_id" uuid references "public"."contract_document_versions"("id") on delete set null,
    "created_by" uuid references "auth"."users"("id") on delete set null,
    "created_at" timestamptz not null default now(),
    constraint "contract_partner_comments_author_type_check"
        check ("author_type" in ('partner', 'internal'))
);

create index if not exists "contract_partner_comments_submission_created_idx"
    on "public"."contract_partner_comments" ("submission_id", "created_at" asc);

alter table "public"."contract_partner_comments" enable row level security;

drop policy if exists "Contracts admins manage partner comments" on "public"."contract_partner_comments";
create policy "Contracts admins manage partner comments"
    on "public"."contract_partner_comments"
    as permissive
    for all
    to authenticated
    using (
        exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
        or exists (
            select 1 from "public"."members" m
            join "public"."department_permissions" dp on dp.department = m.department
            where m.user_id = auth.uid()
              and coalesce(m.member_status, case when m.active then 'active' else 'inactive' end) = 'active'
              and dp.permissions ? 'contracts.admin'
        )
    )
    with check (
        exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
        or exists (
            select 1 from "public"."members" m
            join "public"."department_permissions" dp on dp.department = m.department
            where m.user_id = auth.uid()
              and coalesce(m.member_status, case when m.active then 'active' else 'inactive' end) = 'active'
              and dp.permissions ? 'contracts.admin'
        )
    );

grant select, insert on table "public"."contract_partner_comments" to "authenticated";
grant all on table "public"."contract_partner_comments" to "service_role";

commit;
