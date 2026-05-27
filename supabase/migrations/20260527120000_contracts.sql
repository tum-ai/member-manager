begin;

-- =========================================================================
-- Contract Generator: templates, variables, conditional blocks, submissions
-- Ported from the standalone contract-generator app. Admins of Legal &
-- Finance own templates; any authenticated member can submit; partner
-- signing happens via a one-time signature_token (server enforces).
-- =========================================================================

create table if not exists "public"."contract_templates" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "contract_text" text not null default '',
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

create index if not exists "contract_templates_active_idx"
    on "public"."contract_templates" ("is_active", "name");

create table if not exists "public"."contract_template_variables" (
    "id" uuid primary key default gen_random_uuid(),
    "template_id" uuid not null references "public"."contract_templates"("id") on delete cascade,
    "variable_name" text not null,
    "label" text not null,
    "data_type" text not null default 'TEXT',
    "help_text" text,
    "options" jsonb,
    "is_required" boolean not null default false,
    "is_multiselect" boolean not null default false,
    "show_if_variable" text,
    "show_if_value" text,
    "sort_order" integer not null default 0,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "contract_template_variables_data_type_check"
        check ("data_type" in ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE')),
    constraint "contract_template_variables_template_variable_unique"
        unique ("template_id", "variable_name")
);

create index if not exists "contract_template_variables_template_sort_idx"
    on "public"."contract_template_variables" ("template_id", "sort_order");

create table if not exists "public"."contract_conditional_blocks" (
    "id" uuid primary key default gen_random_uuid(),
    "template_id" uuid not null references "public"."contract_templates"("id") on delete cascade,
    "name" text not null,
    "condition_type" text not null default 'ALWAYS',
    "condition_variable" text,
    "condition_value" text,
    "block_text" text not null default '',
    "sort_order" integer not null default 0,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "contract_conditional_blocks_condition_type_check"
        check ("condition_type" in ('ALWAYS', 'IF_YES', 'IF_NO', 'IF_VALUE'))
);

create index if not exists "contract_conditional_blocks_template_sort_idx"
    on "public"."contract_conditional_blocks" ("template_id", "sort_order");

create table if not exists "public"."contract_submissions" (
    "id" uuid primary key default gen_random_uuid(),
    "template_id" uuid not null references "public"."contract_templates"("id") on delete restrict,
    "submitter_user_id" uuid not null references "auth"."users"("id") on delete cascade,
    "form_data" jsonb not null default '{}'::jsonb,
    "generated_contract_text" text,
    "admin_edited_text" text,
    "status" text not null default 'submitted',
    "notes" text,
    "feedback_message" text,
    "signature_token" text unique,
    "signature_token_expires_at" timestamptz,
    "signature_data" text,
    "signer_name" text,
    "signed_at" timestamptz,
    "admin_signature_data" text,
    "admin_signer_name" text,
    "admin_signed_at" timestamptz,
    "reviewed_by" uuid references "auth"."users"("id") on delete set null,
    "reviewed_at" timestamptz,
    "submitted_at" timestamptz not null default now(),
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "contract_submissions_status_check"
        check ("status" in ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'inquiry', 'signed', 'completed'))
);

create index if not exists "contract_submissions_status_created_idx"
    on "public"."contract_submissions" ("status", "created_at" desc);

create index if not exists "contract_submissions_submitter_idx"
    on "public"."contract_submissions" ("submitter_user_id", "created_at" desc);

-- =========================================================================
-- RLS
-- =========================================================================

alter table "public"."contract_templates" enable row level security;
alter table "public"."contract_template_variables" enable row level security;
alter table "public"."contract_conditional_blocks" enable row level security;
alter table "public"."contract_submissions" enable row level security;

-- A reusable predicate: caller is admin OR a member of Legal & Finance.
-- Inlined per policy to avoid a function dependency.

-- ---- contract_templates ----
drop policy if exists "L&F manage contract templates" on "public"."contract_templates";
create policy "L&F manage contract templates"
    on "public"."contract_templates"
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

drop policy if exists "Authenticated read active templates" on "public"."contract_templates";
create policy "Authenticated read active templates"
    on "public"."contract_templates"
    as permissive
    for select
    to authenticated
    using ("is_active" = true);

-- ---- contract_template_variables ----
drop policy if exists "L&F manage variables" on "public"."contract_template_variables";
create policy "L&F manage variables"
    on "public"."contract_template_variables"
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

drop policy if exists "Authenticated read variables of active templates" on "public"."contract_template_variables";
create policy "Authenticated read variables of active templates"
    on "public"."contract_template_variables"
    as permissive
    for select
    to authenticated
    using (
        exists (
            select 1 from "public"."contract_templates" t
            where t.id = "contract_template_variables"."template_id" and t.is_active = true
        )
    );

-- ---- contract_conditional_blocks ----
drop policy if exists "L&F manage blocks" on "public"."contract_conditional_blocks";
create policy "L&F manage blocks"
    on "public"."contract_conditional_blocks"
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

-- ---- contract_submissions ----
drop policy if exists "L&F manage submissions" on "public"."contract_submissions";
create policy "L&F manage submissions"
    on "public"."contract_submissions"
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

drop policy if exists "Submitters insert own submissions" on "public"."contract_submissions";
create policy "Submitters insert own submissions"
    on "public"."contract_submissions"
    as permissive
    for insert
    to authenticated
    with check ("submitter_user_id" = auth.uid());

drop policy if exists "Submitters read own submissions" on "public"."contract_submissions";
create policy "Submitters read own submissions"
    on "public"."contract_submissions"
    as permissive
    for select
    to authenticated
    using ("submitter_user_id" = auth.uid());

-- =========================================================================
-- Privileges. Public signing endpoint runs server-side as service_role
-- (uses signature_token lookup); anon needs no direct table access.
-- =========================================================================

revoke all on table "public"."contract_templates" from "anon";
revoke all on table "public"."contract_template_variables" from "anon";
revoke all on table "public"."contract_conditional_blocks" from "anon";
revoke all on table "public"."contract_submissions" from "anon";

grant select on table "public"."contract_templates" to "authenticated";
grant select on table "public"."contract_template_variables" to "authenticated";
grant select on table "public"."contract_conditional_blocks" to "authenticated";
grant select, insert on table "public"."contract_submissions" to "authenticated";

grant all on table "public"."contract_templates" to "service_role";
grant all on table "public"."contract_template_variables" to "service_role";
grant all on table "public"."contract_conditional_blocks" to "service_role";
grant all on table "public"."contract_submissions" to "service_role";

commit;
