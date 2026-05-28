begin;

-- =========================================================================
-- Member CVs: immutable, versioned CV storage.
--
-- Member Manager is the source of truth for "what is this member's current
-- CV right now". Files live in a PRIVATE Supabase Storage bucket; this table
-- holds one immutable row per uploaded version. Exactly one row per member is
-- the current version. Files are never overwritten: a new upload inserts a
-- new version and flips the previous one's is_current to false.
--
-- Partner sharing is gated by a MEMBER-LEVEL consent flag on `members`
-- (opt-in). The Partner Portal is a separate product that consumes a
-- server-side export (manifest + short-lived signed URLs) and freezes its own
-- snapshots; it never reads this storage live. See docs/member-cvs.md.
-- =========================================================================

-- ---- Private storage bucket -------------------------------------------------
-- Source of truth for the bucket lives here so local (`supabase db reset`) and
-- prod (`supabase db push`) stay in parity. `config.toml` only sets local-dev
-- limits. PDF-only, 5 MB cap enforced both here and in the API layer.
insert into "storage"."buckets" (
    "id", "name", "public", "file_size_limit", "allowed_mime_types"
)
values (
    'member-cvs',
    'member-cvs',
    false,
    5242880, -- 5 MiB
    array['application/pdf']
)
on conflict ("id") do update set
    "public" = excluded."public",
    "file_size_limit" = excluded."file_size_limit",
    "allowed_mime_types" = excluded."allowed_mime_types";

-- No storage.objects RLS policies are added: all object access is mediated by
-- the server using the service role (uploads, signed-URL minting). The bucket
-- stays private; authenticated/anon clients have no direct object access.

-- ---- Member-level partner-sharing consent ----------------------------------
alter table "public"."members"
    add column if not exists "partner_sharing_consent_at" timestamptz;

comment on column "public"."members"."partner_sharing_consent_at" is
    'When the member consented to sharing their current CV with TUM.ai partners. NULL = no consent. Opt-in.';

-- ---- member_cvs table -------------------------------------------------------
create table if not exists "public"."member_cvs" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "auth"."users"("id") on delete cascade,
    "storage_bucket" text not null default 'member-cvs',
    "storage_path" text not null,
    "original_filename" text not null,
    "mime_type" text not null,
    "size_bytes" integer not null,
    "sha256" text not null,
    "source" text not null,
    "version" integer not null,
    "is_current" boolean not null default true,
    "uploaded_at" timestamptz not null default now(),
    "uploaded_by_user_id" uuid references "auth"."users"("id") on delete set null,
    "supersedes_cv_id" uuid references "public"."member_cvs"("id") on delete set null,
    "revoked_at" timestamptz,
    "created_at" timestamptz not null default now(),
    constraint "member_cvs_mime_type_check"
        check ("mime_type" = 'application/pdf'),
    constraint "member_cvs_source_check"
        check ("source" in ('application', 'member_upload', 'admin_upload')),
    constraint "member_cvs_size_bytes_check"
        check ("size_bytes" > 0 and "size_bytes" <= 5242880),
    constraint "member_cvs_version_positive_check"
        check ("version" >= 1),
    constraint "member_cvs_user_version_unique"
        unique ("user_id", "version"),
    constraint "member_cvs_storage_path_unique"
        unique ("storage_path")
);

-- One current CV per member. Partial unique index over is_current = true.
create unique index if not exists "member_cvs_one_current_per_user_idx"
    on "public"."member_cvs" ("user_id")
    where ("is_current" = true);

create index if not exists "member_cvs_user_version_idx"
    on "public"."member_cvs" ("user_id", "version" desc);

comment on table "public"."member_cvs" is
    'Immutable, versioned member CVs. Files in the private member-cvs bucket; never overwritten. Exactly one is_current row per member.';

-- =========================================================================
-- RLS. Members read their own CV rows; admins read/manage all. All writes go
-- through the server (service_role), which bypasses RLS. Mirrors the
-- contracts migration policy style.
-- =========================================================================

alter table "public"."member_cvs" enable row level security;

drop policy if exists "Members read own CVs" on "public"."member_cvs";
create policy "Members read own CVs"
    on "public"."member_cvs"
    as permissive
    for select
    to authenticated
    using (
        "user_id" = auth.uid()
        or exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    );

-- =========================================================================
-- Privileges. Server uses the service role for all CV reads/writes and
-- signed-URL minting. Authenticated clients only need SELECT for metadata
-- (file bytes are never exposed to them directly). anon gets nothing.
-- =========================================================================

revoke all on table "public"."member_cvs" from "anon";
grant select on table "public"."member_cvs" to "authenticated";
grant all on table "public"."member_cvs" to "service_role";

commit;
