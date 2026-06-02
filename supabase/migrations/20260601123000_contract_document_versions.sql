begin;

create table if not exists "public"."contract_document_versions" (
    "id" uuid primary key default gen_random_uuid(),
    "submission_id" uuid not null references "public"."contract_submissions"("id") on delete cascade,
    "version_number" integer not null,
    "source" text not null,
    "rendered_text" text not null,
    "rendered_html" text not null default '',
    "form_data_snapshot" jsonb not null default '{}'::jsonb,
    "created_by" uuid references "auth"."users"("id") on delete set null,
    "created_at" timestamptz not null default now(),
    constraint "contract_document_versions_source_check"
        check ("source" in ('draft', 'generated', 'legal_review', 'sent_to_partner', 'partner_signed', 'board_signed', 'final')),
    constraint "contract_document_versions_submission_version_unique"
        unique ("submission_id", "version_number")
);

alter table "public"."contract_submissions"
    add column if not exists "active_document_version_id" uuid references "public"."contract_document_versions"("id") on delete set null,
    add column if not exists "sent_document_version_id" uuid references "public"."contract_document_versions"("id") on delete set null,
    add column if not exists "final_document_version_id" uuid references "public"."contract_document_versions"("id") on delete set null;

create index if not exists "contract_document_versions_submission_idx"
    on "public"."contract_document_versions" ("submission_id", "version_number" desc);

create index if not exists "contract_submissions_active_document_version_idx"
    on "public"."contract_submissions" ("active_document_version_id");

alter table "public"."contract_document_versions" enable row level security;

drop policy if exists "L&F manage contract document versions" on "public"."contract_document_versions";
create policy "L&F manage contract document versions"
    on "public"."contract_document_versions"
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
            where m.user_id = auth.uid() and m.department = 'Legal & Finance'
        )
    )
    with check (
        exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
        or exists (
            select 1 from "public"."members" m
            where m.user_id = auth.uid() and m.department = 'Legal & Finance'
        )
    );

drop policy if exists "Submitters read own contract document versions" on "public"."contract_document_versions";
create policy "Submitters read own contract document versions"
    on "public"."contract_document_versions"
    as permissive
    for select
    to authenticated
    using (
        exists (
            select 1 from "public"."contract_submissions" s
            where s.id = "contract_document_versions"."submission_id"
              and s.submitter_user_id = auth.uid()
        )
    );

grant select on table "public"."contract_document_versions" to "authenticated";
grant all on table "public"."contract_document_versions" to "service_role";

commit;
