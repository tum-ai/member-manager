begin;

-- =========================================================================
-- Beacon — internal expertise portal schema.
--
-- Two layers:
--   Layer A (truth): canonical entities (organization/school/skill/project)
--     + claim edges (employment/education/person_skill/person_project/
--     person_tag). EVERY edge carries provenance: source_id, confidence (0..1)
--     and status (confirmed|pending|rejected) + the raw extracted value. The
--     enrichment job proposes claims as 'pending'; members confirm/edit/reject
--     them on their rich profile (Phase 2). Nothing is ever auto-trusted.
--   Layer B (search): `beacon_search_chunk` — derived ONLY from confirmed
--     Layer-A claims, embedded for hybrid (dense pgvector + sparse tsvector)
--     retrieval. Never hand-edited; always regenerated from Layer A.
--
-- All Beacon tables are prefixed `beacon_` to namespace them clearly from the
-- core member-manager schema (this is an isolated exploration that can be
-- dropped wholesale).
--
-- The person is the existing `public.members` row, keyed by `user_id`
-- (= auth.users.id, the universal internal key). Per-person Beacon state
-- (consent / opt-out / editable headline+summary) lives in `beacon_person`.
--
-- Access: the Fastify server mediates ALL reads/writes via the service role,
-- which bypasses RLS. The RLS policies below are a defensive second layer
-- (member-only directory read; self-edit on own claims).
-- =========================================================================

-- ---- Extensions -------------------------------------------------------------
-- pgvector for embeddings; pg_trgm for fuzzy canonical-name matching during
-- entity resolution. Installed into the `extensions` schema (Supabase
-- convention; `extensions` is on every request's search_path per config.toml),
-- so the `vector` type resolves unqualified.
create extension if not exists "vector" with schema "extensions";
create extension if not exists "pg_trgm" with schema "extensions";

-- ---- Admin helper -----------------------------------------------------------
-- DRYs the `user_roles` admin check used across the RLS policies below.
-- security definer so the policy can read user_roles regardless of the
-- caller's own RLS on that table.
create or replace function "public"."beacon_is_admin"()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from "public"."user_roles" ur
        where ur.user_id = auth.uid() and ur.role = 'admin'
    );
$$;

-- =========================================================================
-- Per-person Beacon state.
-- =========================================================================
create table if not exists "public"."beacon_person" (
    "user_id" uuid primary key references "public"."members"("user_id") on delete cascade,
    "headline" text,                                  -- member-editable one-liner
    "summary" text,                                   -- member-editable bio
    "consent_at" timestamptz,                         -- when the member consented to enrichment
    "opted_out" boolean not null default false,       -- hard opt-out: hide + purge chunks
    "last_enriched_at" timestamptz,                   -- bookkeeping for the enrichment job
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);

comment on table "public"."beacon_person" is
    'Per-member Beacon state: editable headline/summary, enrichment consent, and hard opt-out.';

-- =========================================================================
-- Provenance.
-- =========================================================================
create table if not exists "public"."beacon_source" (
    "id" uuid primary key default gen_random_uuid(),
    "kind" text not null
        check ("kind" in ('self', 'csv', 'github', 'linkedin', 'pdl', 'blog', 'web_search', 'slack')),
    "url" text,
    "title" text,
    "identity_confirmed" boolean not null default false, -- verified to be THIS person
    "fetched_at" timestamptz,
    "created_at" timestamptz not null default now()
);

comment on table "public"."beacon_source" is
    'Origin of a claim (self report, PDL, GitHub, a web page, …). identity_confirmed gates auto-confirmation in enrichment.';

create index if not exists "beacon_source_kind_idx" on "public"."beacon_source" ("kind");

-- =========================================================================
-- Canonical entities. canonical_key = normalized (lowercased, trimmed) name
-- used for dedup/resolution; tags/groups arrays power set-membership queries
-- ("big tech", "Ivy League"). GIN indexes on the arrays + trigram on name.
-- =========================================================================
create table if not exists "public"."beacon_organization" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "canonical_key" text not null unique,
    "domain" text,
    "tags" text[] not null default '{}',  -- e.g. {bigtech,faang}, {consulting}, {startup}
    "created_at" timestamptz not null default now()
);
create index if not exists "beacon_organization_tags_idx"
    on "public"."beacon_organization" using gin ("tags");
create index if not exists "beacon_organization_name_trgm_idx"
    on "public"."beacon_organization" using gin ("name" extensions.gin_trgm_ops);

create table if not exists "public"."beacon_school" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "canonical_key" text not null unique,
    "country" text,
    "groups" text[] not null default '{}',  -- e.g. {ivy_league}, {oxbridge}, {tu9}
    "created_at" timestamptz not null default now()
);
create index if not exists "beacon_school_groups_idx"
    on "public"."beacon_school" using gin ("groups");
create index if not exists "beacon_school_name_trgm_idx"
    on "public"."beacon_school" using gin ("name" extensions.gin_trgm_ops);

create table if not exists "public"."beacon_skill" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "canonical_key" text not null unique,
    "category" text,  -- e.g. language | framework | domain | tool | platform
    "created_at" timestamptz not null default now()
);
create index if not exists "beacon_skill_name_trgm_idx"
    on "public"."beacon_skill" using gin ("name" extensions.gin_trgm_ops);

create table if not exists "public"."beacon_project" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "canonical_key" text not null unique,
    "url" text,
    "description" text,
    "created_at" timestamptz not null default now()
);

-- Controlled capability-tag vocabulary. person_tag.tag FKs here so the tag
-- space stays curated (enrichment must map to an existing tag, not invent one).
create table if not exists "public"."beacon_tag_vocabulary" (
    "tag" text primary key,
    "label" text not null,
    "category" text,  -- e.g. seniority | domain | capability
    "description" text
);

-- =========================================================================
-- Claim edges. Shared provenance columns on every edge:
--   user_id, source_id, confidence (0..1), status, raw_value, timestamps.
-- =========================================================================
create table if not exists "public"."beacon_employment" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "organization_id" uuid references "public"."beacon_organization"("id") on delete set null,
    "title" text,
    "start_year" smallint,
    "end_year" smallint,
    "is_current" boolean not null default false,
    "source_id" uuid references "public"."beacon_source"("id") on delete set null,
    "confidence" real not null default 0.5 check ("confidence" >= 0 and "confidence" <= 1),
    "status" text not null default 'pending'
        check ("status" in ('confirmed', 'pending', 'rejected')),
    "raw_value" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);
create index if not exists "beacon_employment_user_idx" on "public"."beacon_employment" ("user_id");
create index if not exists "beacon_employment_org_idx" on "public"."beacon_employment" ("organization_id");
create index if not exists "beacon_employment_status_idx" on "public"."beacon_employment" ("status");
-- Dedup target for idempotent re-enrichment (resolved orgs only).
create unique index if not exists "beacon_employment_dedup_idx"
    on "public"."beacon_employment" ("user_id", "organization_id", coalesce("title", ''))
    where ("organization_id" is not null);

create table if not exists "public"."beacon_education" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "school_id" uuid references "public"."beacon_school"("id") on delete set null,
    "degree" text,  -- e.g. BSc | MSc | PhD | MBA
    "field" text,   -- field of study
    "start_year" smallint,
    "end_year" smallint,
    "source_id" uuid references "public"."beacon_source"("id") on delete set null,
    "confidence" real not null default 0.5 check ("confidence" >= 0 and "confidence" <= 1),
    "status" text not null default 'pending'
        check ("status" in ('confirmed', 'pending', 'rejected')),
    "raw_value" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
);
create index if not exists "beacon_education_user_idx" on "public"."beacon_education" ("user_id");
create index if not exists "beacon_education_school_idx" on "public"."beacon_education" ("school_id");
create index if not exists "beacon_education_status_idx" on "public"."beacon_education" ("status");
create unique index if not exists "beacon_education_dedup_idx"
    on "public"."beacon_education" ("user_id", "school_id", coalesce("degree", ''))
    where ("school_id" is not null);

create table if not exists "public"."beacon_person_skill" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "skill_id" uuid not null references "public"."beacon_skill"("id") on delete cascade,
    "proficiency" text
        check ("proficiency" is null or "proficiency" in ('beginner', 'intermediate', 'advanced', 'expert')),
    "source_id" uuid references "public"."beacon_source"("id") on delete set null,
    "confidence" real not null default 0.5 check ("confidence" >= 0 and "confidence" <= 1),
    "status" text not null default 'pending'
        check ("status" in ('confirmed', 'pending', 'rejected')),
    "raw_value" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "beacon_person_skill_unique" unique ("user_id", "skill_id")
);
create index if not exists "beacon_person_skill_user_idx" on "public"."beacon_person_skill" ("user_id");
create index if not exists "beacon_person_skill_skill_idx" on "public"."beacon_person_skill" ("skill_id");
create index if not exists "beacon_person_skill_status_idx" on "public"."beacon_person_skill" ("status");

create table if not exists "public"."beacon_person_project" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "project_id" uuid not null references "public"."beacon_project"("id") on delete cascade,
    "role" text,
    "source_id" uuid references "public"."beacon_source"("id") on delete set null,
    "confidence" real not null default 0.5 check ("confidence" >= 0 and "confidence" <= 1),
    "status" text not null default 'pending'
        check ("status" in ('confirmed', 'pending', 'rejected')),
    "raw_value" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "beacon_person_project_unique" unique ("user_id", "project_id")
);
create index if not exists "beacon_person_project_user_idx" on "public"."beacon_person_project" ("user_id");
create index if not exists "beacon_person_project_project_idx" on "public"."beacon_person_project" ("project_id");

create table if not exists "public"."beacon_person_tag" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "tag" text not null references "public"."beacon_tag_vocabulary"("tag") on delete cascade,
    "source_id" uuid references "public"."beacon_source"("id") on delete set null,
    "confidence" real not null default 0.5 check ("confidence" >= 0 and "confidence" <= 1),
    "status" text not null default 'pending'
        check ("status" in ('confirmed', 'pending', 'rejected')),
    "raw_value" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "beacon_person_tag_unique" unique ("user_id", "tag")
);
create index if not exists "beacon_person_tag_user_idx" on "public"."beacon_person_tag" ("user_id");
create index if not exists "beacon_person_tag_tag_idx" on "public"."beacon_person_tag" ("tag");
create index if not exists "beacon_person_tag_status_idx" on "public"."beacon_person_tag" ("status");

-- =========================================================================
-- Layer B — search index. Derived only from confirmed Layer-A claims.
-- `lexeme` is a generated tsvector (immutable 2-arg to_tsvector) so it stays
-- in sync automatically; `embedding` is populated by buildSearchChunks (Phase 4).
-- =========================================================================
create table if not exists "public"."beacon_search_chunk" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "kind" text not null
        check ("kind" in ('headline', 'bio', 'employment', 'education', 'skill_cluster', 'project', 'tag')),
    "content" text not null,
    "embedding" extensions.vector(1536),  -- OpenAI text-embedding-3-small
    "lexeme" tsvector generated always as (to_tsvector('english', "content")) stored,
    "created_at" timestamptz not null default now()
);
create index if not exists "beacon_search_chunk_user_idx" on "public"."beacon_search_chunk" ("user_id");
create index if not exists "beacon_search_chunk_lexeme_idx"
    on "public"."beacon_search_chunk" using gin ("lexeme");
-- HNSW for cosine ANN. OpenAI embeddings are normalized → cosine (`<=>`).
create index if not exists "beacon_search_chunk_embedding_idx"
    on "public"."beacon_search_chunk" using hnsw ("embedding" extensions.vector_cosine_ops);

comment on table "public"."beacon_search_chunk" is
    'Layer B: hybrid-search index regenerated from confirmed Layer-A claims. Never hand-edited.';

-- =========================================================================
-- Keep updated_at fresh on the mutable tables.
-- =========================================================================
create or replace function "public"."beacon_touch_updated_at"()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array[
        'beacon_person', 'beacon_employment', 'beacon_education',
        'beacon_person_skill', 'beacon_person_project', 'beacon_person_tag'
    ] loop
        execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
        execute format(
            'create trigger %I before update on public.%I for each row execute function public.beacon_touch_updated_at()',
            t || '_touch', t
        );
    end loop;
end;
$$;

-- =========================================================================
-- RLS. Defensive layer (server uses service_role → bypasses these):
--   * canonical entities + vocabulary + sources: any authenticated member may
--     read (shared reference data); only service_role writes.
--   * person + claim edges + chunks: a member reads their OWN rows (any status)
--     plus everyone's CONFIRMED rows (the directory); admins read all. Members
--     may self-edit/delete their own claim edges + beacon_person (Phase 2);
--     chunk writes are server-only.
-- =========================================================================

-- Reference tables: read-only to authenticated.
do $$
declare
    t text;
begin
    foreach t in array array[
        'beacon_source', 'beacon_organization', 'beacon_school',
        'beacon_skill', 'beacon_project', 'beacon_tag_vocabulary'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists "Authenticated read %s" on public.%I', t, t);
        execute format(
            'create policy "Authenticated read %s" on public.%I as permissive for select to authenticated using (true)',
            t, t
        );
        execute format('revoke all on table public.%I from anon', t);
        execute format('grant select on table public.%I to authenticated', t);
        execute format('grant all on table public.%I to service_role', t);
    end loop;
end;
$$;

-- beacon_person: directory-readable; self-managed.
alter table "public"."beacon_person" enable row level security;
drop policy if exists "Read beacon_person" on "public"."beacon_person";
create policy "Read beacon_person"
    on "public"."beacon_person" as permissive for select to authenticated
    using ("opted_out" = false or "user_id" = auth.uid() or "public"."beacon_is_admin"());
drop policy if exists "Manage own beacon_person" on "public"."beacon_person";
create policy "Manage own beacon_person"
    on "public"."beacon_person" as permissive for all to authenticated
    using ("user_id" = auth.uid() or "public"."beacon_is_admin"())
    with check ("user_id" = auth.uid() or "public"."beacon_is_admin"());
revoke all on table "public"."beacon_person" from anon;
grant select, insert, update, delete on table "public"."beacon_person" to authenticated;
grant all on table "public"."beacon_person" to service_role;

-- Claim edges: own (any status) + confirmed (anyone) readable; self-managed.
do $$
declare
    t text;
begin
    foreach t in array array[
        'beacon_employment', 'beacon_education', 'beacon_person_skill',
        'beacon_person_project', 'beacon_person_tag'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists "Read %s" on public.%I', t, t);
        execute format(
            'create policy "Read %s" on public.%I as permissive for select to authenticated '
            || 'using (status = ''confirmed'' or user_id = auth.uid() or public.beacon_is_admin())',
            t, t
        );
        execute format('drop policy if exists "Manage own %s" on public.%I', t, t);
        execute format(
            'create policy "Manage own %s" on public.%I as permissive for all to authenticated '
            || 'using (user_id = auth.uid() or public.beacon_is_admin()) '
            || 'with check (user_id = auth.uid() or public.beacon_is_admin())',
            t, t
        );
        execute format('revoke all on table public.%I from anon', t);
        execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
        execute format('grant all on table public.%I to service_role', t);
    end loop;
end;
$$;

-- search_chunk: read own + confirmed; writes are server-only.
alter table "public"."beacon_search_chunk" enable row level security;
drop policy if exists "Read beacon_search_chunk" on "public"."beacon_search_chunk";
create policy "Read beacon_search_chunk"
    on "public"."beacon_search_chunk" as permissive for select to authenticated
    using ("user_id" = auth.uid() or "public"."beacon_is_admin"() or exists (
        select 1 from "public"."beacon_person" bp
        where bp.user_id = "beacon_search_chunk".user_id and bp.opted_out = false
    ));
revoke all on table "public"."beacon_search_chunk" from anon;
grant select on table "public"."beacon_search_chunk" to authenticated;
grant all on table "public"."beacon_search_chunk" to service_role;

commit;
