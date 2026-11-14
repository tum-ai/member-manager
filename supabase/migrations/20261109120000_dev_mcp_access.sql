-- Dev MCP (`tum-ai/dev-mcp`, the MCP server behind Dev Claude) access, managed
-- here instead of in dev-mcp's own database.
--
-- dev-mcp keeps enforcing (roles, its code policy, pending actions); only the
-- data behind "who may use it, with which role and tools" moves here, next to
-- nomcp's access on /admin/mcp-access. dev-mcp reads it two ways, both keyed
-- by the member's Slack user ID:
--
-- - Dev Claude run tokens: the server's service API
--   (`/api/internal/dev-mcp/access/:slackUserId`) calls
--   `public.dev_mcp_access_for(slack_user_id)`.
-- - Member OAuth tokens (Claude Code, claude.ai, ... connected directly):
--   dev-mcp calls `public.dev_mcp_principal()` with the token.
--
-- Supabase's OAuth tokens name no audience, so a token issued for nomcp would
-- otherwise also work at dev-mcp. The consent page therefore binds each OAuth
-- client to the one MCP server (RFC 8707 `resource`) it was authorized for
-- (`public.bind_oauth_authorization`), and `dev_mcp_principal()` only answers
-- for clients bound to dev-mcp's resource URL.
--
-- Every change to a member's access writes a `dev_mcp_access_events` row in
-- the same transaction (`dev_mcp_file_request`, `dev_mcp_apply_change`); the
-- server never writes the access tables directly.

-- 1. Tables ------------------------------------------------------------------

create table if not exists "public"."dev_mcp_access" (
    "user_id" uuid primary key
        references "public"."members" ("user_id") on delete cascade,
    "status" text not null default 'requested'
        check ("status" in ('requested', 'active', 'suspended', 'denied')),
    "role" text check ("role" in ('member', 'lead', 'admin')),
    "requested_at" timestamptz not null default now(),
    "decided_at" timestamptz,
    "decided_by" uuid references "auth"."users" ("id") on delete set null,
    "decision_note" text
        check ("decision_note" is null or char_length("decision_note") <= 500),
    "last_seen_at" timestamptz,
    "last_client_id" text,
    "last_client_name" text,
    -- An active member always has a role; nobody else has one.
    constraint "dev_mcp_access_role_only_when_active"
        check (("status" = 'active') = ("role" is not null))
);

comment on table "public"."dev_mcp_access" is
    'Dev MCP (dev-mcp, Dev Claude) access per member, decided by admins. Written only through dev_mcp_file_request() and dev_mcp_apply_change().';
comment on column "public"."dev_mcp_access"."status" is
    'requested: waiting for an admin. active: may use dev-mcp. suspended: access taken away. denied: request declined (the member may request again).';
comment on column "public"."dev_mcp_access"."role" is
    'dev-mcp role while active (member < lead < admin); caps which tools can be granted.';
comment on column "public"."dev_mcp_access"."decision_note" is
    'Admin-only note on the last decision. Not visible to the member.';
comment on column "public"."dev_mcp_access"."last_seen_at" is
    'Last OAuth sign-in check (dev_mcp_principal), updated at most once per minute. Dev Claude runs do not touch it.';

create table if not exists "public"."dev_mcp_tool_grants" (
    "user_id" uuid not null
        references "public"."dev_mcp_access" ("user_id") on delete cascade,
    "tool" text not null check ("tool" ~ '^[a-z][a-z0-9_]{0,63}$'),
    "granted_by" uuid references "auth"."users" ("id") on delete set null,
    "granted_at" timestamptz not null default now(),
    primary key ("user_id", "tool")
);

comment on table "public"."dev_mcp_tool_grants" is
    'dev-mcp tools granted per member (tool names from dev-mcp''s catalog). Only meaningful while the member is active; dev-mcp still caps them by role and its code policy.';

create table if not exists "public"."dev_mcp_access_events" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null
        references "public"."members" ("user_id") on delete cascade,
    "actor_id" uuid references "auth"."users" ("id") on delete set null,
    "source" text not null
        check ("source" in ('admin', 'dev_mcp', 'oauth', 'import', 'system')),
    "action" text not null
        check ("action" in ('access_requested', 'member_approved', 'member_updated', 'member_tools_set', 'member_imported')),
    "details" jsonb not null default '{}'::jsonb,
    "at" timestamptz not null default now()
);

create index if not exists "dev_mcp_access_events_user_at_idx"
    on "public"."dev_mcp_access_events" ("user_id", "at" desc);

comment on table "public"."dev_mcp_access_events" is
    'Append-only history of every dev-mcp access change, written in the same transaction as the change.';
comment on column "public"."dev_mcp_access_events"."source" is
    'admin: /admin/mcp-access. dev_mcp: the service API (e.g. Dev Claude''s request access). oauth: first use through dev_mcp_principal(). import: the import script. system: migrations and seeds.';

-- OAuth client -> the one MCP server (RFC 8707 resource) it was authorized for.
create table if not exists "public"."mcp_client_resources" (
    "client_id" uuid primary key,
    "resource" text not null
        check (char_length("resource") between 1 and 2048),
    "user_id" uuid references "auth"."users" ("id") on delete set null,
    "bound_at" timestamptz not null default now()
);

comment on table "public"."mcp_client_resources" is
    'Each OAuth client (auth.oauth_clients.id) is bound to the resource of its first approved authorization; written by bind_oauth_authorization() from the consent page.';
comment on column "public"."mcp_client_resources"."user_id" is
    'Member whose consent created the binding.';

-- Resource URLs of TUM.ai's MCP servers, as MCP clients send them. Changed in
-- SQL only.
create table if not exists "public"."mcp_resource_settings" (
    "key" text primary key check ("key" ~ '^[a-z][a-z0-9_]*$'),
    "resource" text not null
        check (char_length("resource") between 1 and 2048),
    "updated_at" timestamptz not null default now()
);

comment on table "public"."mcp_resource_settings" is
    'Resource URL (RFC 8707/9728) per TUM.ai MCP server; dev_mcp = dev-mcp''s <PUBLIC_BASE_URL>/mcp. supabase/seed.sql overrides it locally.';

insert into "public"."mcp_resource_settings" ("key", "resource")
values ('dev_mcp', 'https://tumai-dev-mcp.vercel.app/mcp')
on conflict ("key") do nothing;

-- 2. Row-level security and grants -------------------------------------------

alter table "public"."dev_mcp_access" enable row level security;
alter table "public"."dev_mcp_tool_grants" enable row level security;
alter table "public"."dev_mcp_access_events" enable row level security;
alter table "public"."mcp_client_resources" enable row level security;
alter table "public"."mcp_resource_settings" enable row level security;

-- The default privileges grant every new table to anon and authenticated.
-- Members may read their own status and grants, not who decided or the
-- admin's note; everything else goes through the API (service role) and the
-- functions below.
revoke all on table "public"."dev_mcp_access" from public, anon, authenticated;
grant select (
    "user_id",
    "status",
    "role",
    "requested_at",
    "decided_at",
    "last_seen_at",
    "last_client_id",
    "last_client_name"
) on table "public"."dev_mcp_access" to authenticated;
grant select, insert, update, delete on table "public"."dev_mcp_access" to service_role;

revoke all on table "public"."dev_mcp_tool_grants" from public, anon, authenticated;
grant select ("user_id", "tool", "granted_at")
    on table "public"."dev_mcp_tool_grants" to authenticated;
grant select, insert, update, delete on table "public"."dev_mcp_tool_grants" to service_role;

-- Admin-only history, append-only even for the service role.
revoke all on table "public"."dev_mcp_access_events" from public, anon, authenticated, service_role;
grant select, insert on table "public"."dev_mcp_access_events" to service_role;

revoke all on table "public"."mcp_client_resources" from public, anon, authenticated;
grant select, insert, update, delete on table "public"."mcp_client_resources" to service_role;

revoke all on table "public"."mcp_resource_settings" from public, anon, authenticated;
grant select, insert, update on table "public"."mcp_resource_settings" to service_role;

create policy "Members can view own dev-mcp access" on "public"."dev_mcp_access"
    for select to authenticated
    using ((select auth.uid()) = "user_id");

create policy "Members can view own dev-mcp tool grants" on "public"."dev_mcp_tool_grants"
    for select to authenticated
    using ((select auth.uid()) = "user_id");

create policy "oauth_clients_blocked" on "public"."dev_mcp_access" as restrictive for all to authenticated
    using ((select auth.jwt() ->> 'client_id') is null)
    with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth_clients_blocked" on "public"."dev_mcp_tool_grants" as restrictive for all to authenticated
    using ((select auth.jwt() ->> 'client_id') is null)
    with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth_clients_blocked" on "public"."dev_mcp_access_events" as restrictive for all to authenticated
    using ((select auth.jwt() ->> 'client_id') is null)
    with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth_clients_blocked" on "public"."mcp_client_resources" as restrictive for all to authenticated
    using ((select auth.jwt() ->> 'client_id') is null)
    with check ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth_clients_blocked" on "public"."mcp_resource_settings" as restrictive for all to authenticated
    using ((select auth.jwt() ->> 'client_id') is null)
    with check ((select auth.jwt() ->> 'client_id') is null);

-- 3. Reading access ----------------------------------------------------------

-- The member's Slack user ID in the TUM.ai workspace (T01288YLP16, as in
-- mcp_principal() and handle_new_user), from the auth server's identity row,
-- never from user_metadata. Null without such an identity or when the value
-- isn't a Slack user ID.
create or replace function "public"."member_slack_user_id"("user_id" uuid) returns text
    language sql
    stable
    security definer
    set search_path = ''
    as $$
    select case when s.candidate ~ '^[UW][A-Z0-9]{2,20}$' then s.candidate end
    from (
        select btrim(coalesce(
            i.identity_data -> 'custom_claims' ->> 'https://slack.com/user_id',
            i.identity_data ->> 'sub'
        )) as candidate
        from auth.identities i
        where i.user_id = member_slack_user_id.user_id
          and i.provider = 'slack_oidc'
          and btrim(i.identity_data -> 'custom_claims' ->> 'https://slack.com/team_id') = 'T01288YLP16'
        order by i.updated_at desc nulls last, i.created_at desc nulls last
        limit 1
    ) s
$$;

comment on function "public"."member_slack_user_id"(uuid) is
    'The member''s TUM.ai Slack user ID (U…/W…) from auth.identities, or null.';

-- The access record both dev-mcp paths decide on (contract with dev-mcp):
-- { user_id, slack_user_id, display_name, member_status, slack_team_ok,
--   status: requested | active | suspended | denied | none,
--   role: member | lead | admin (only while active), tools: [] unless active }.
-- Null for a user without a member row.
create or replace function "public"."dev_mcp_access_record"("p_user_id" uuid) returns jsonb
    language sql
    stable
    security definer
    set search_path = ''
    as $$
    select jsonb_build_object(
        'user_id', m.user_id,
        'slack_user_id', public.member_slack_user_id(m.user_id),
        'display_name', coalesce(
            nullif(btrim(concat_ws(' ', btrim(m.given_name), btrim(m.surname))), ''),
            nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
            nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
        ),
        'member_status', m.member_status,
        'slack_team_ok', exists (
            select 1
            from auth.identities i
            where i.user_id = m.user_id
              and i.provider = 'slack_oidc'
              and btrim(i.identity_data -> 'custom_claims' ->> 'https://slack.com/team_id') = 'T01288YLP16'
        ),
        'status', coalesce(a.status, 'none'),
        'role', case when a.status = 'active' then a.role end,
        'tools', case
            when a.status = 'active' then coalesce(
                (
                    select jsonb_agg(g.tool order by g.tool)
                    from public.dev_mcp_tool_grants g
                    where g.user_id = m.user_id
                ),
                '[]'::jsonb
            )
            else '[]'::jsonb
        end
    )
    from public.members m
    left join auth.users u on u.id = m.user_id
    left join public.dev_mcp_access a on a.user_id = m.user_id
    where m.user_id = p_user_id
$$;

comment on function "public"."dev_mcp_access_record"(uuid) is
    'A member''s dev-mcp access record (contract with dev-mcp). Service role only.';

-- The access record of the member with this TUM.ai Slack user ID; null when no
-- member-manager account has it. The service API answers 404 then.
create or replace function "public"."dev_mcp_access_for"("slack_user_id" text) returns jsonb
    language sql
    stable
    security definer
    set search_path = ''
    as $$
    select public.dev_mcp_access_record(i.user_id)
    from auth.identities i
    join public.members m on m.user_id = i.user_id
    where i.provider = 'slack_oidc'
      and btrim(i.identity_data -> 'custom_claims' ->> 'https://slack.com/team_id') = 'T01288YLP16'
      and public.member_slack_user_id(i.user_id) = dev_mcp_access_for.slack_user_id
    order by i.last_sign_in_at desc nulls last, i.user_id
    limit 1
$$;

comment on function "public"."dev_mcp_access_for"(text) is
    'dev-mcp access record by TUM.ai Slack user ID (contract with dev-mcp), or null. Service role only.';

-- 4. Changing access (atomic, with the event row) ------------------------------

-- Files an access request: creates a `requested` row, or moves a `denied` one
-- back to `requested`. True when it did either (a new request needs an admin),
-- false when the member already has another status.
create or replace function "public"."dev_mcp_file_request"(
    "p_user_id" uuid,
    "p_source" text,
    "p_actor_id" uuid default null,
    "p_details" jsonb default '{}'::jsonb
) returns boolean
    language plpgsql
    volatile
    security definer
    set search_path = ''
    as $$
declare
    v_previous public.dev_mcp_access%rowtype;
begin
    insert into public.dev_mcp_access (user_id, status, requested_at)
    values (p_user_id, 'requested', now())
    on conflict (user_id) do nothing;

    if found then
        insert into public.dev_mcp_access_events (user_id, actor_id, source, action, details)
        values (p_user_id, p_actor_id, p_source, 'access_requested', coalesce(p_details, '{}'::jsonb));
        return true;
    end if;

    select * into v_previous
    from public.dev_mcp_access a
    where a.user_id = p_user_id
    for update;

    if v_previous.status is distinct from 'denied' then
        return false;
    end if;

    update public.dev_mcp_access a
    set status = 'requested',
        role = null,
        requested_at = now()
    where a.user_id = p_user_id;

    insert into public.dev_mcp_access_events (user_id, actor_id, source, action, details)
    values (
        p_user_id,
        p_actor_id,
        p_source,
        'access_requested',
        coalesce(p_details, '{}'::jsonb) || jsonb_build_object('previous_status', v_previous.status)
    );
    return true;
end;
$$;

comment on function "public"."dev_mcp_file_request"(uuid, text, uuid, jsonb) is
    'Files a dev-mcp access request (new, or denied -> requested) and its event. Service role only.';

-- Applies one admin (or import) change. The server decides which change an
-- action means and which tools a role allows (dev-mcp's catalog); this
-- function makes it atomic:
--
-- - The member's row must be in one of `p_from_statuses` ('none' = no row),
--   and still have `p_expected_role` when one is given; otherwise someone
--   changed it in the meantime (hint dev_mcp_conflict, or dev_mcp_not_found
--   without a row).
-- - Nobody removes the last active admin (hint dev_mcp_last_admin). Changes
--   are serialized by an advisory lock, so two admins can't demote each other
--   at once.
-- - `p_set_tools` replaces the grants, `p_drop_tools` removes those tools;
--   leaving `active` removes every grant.
-- - The decision note changes only with the status.
-- - One `dev_mcp_access_events` row records what changed; a change that
--   changes nothing records none.
create or replace function "public"."dev_mcp_apply_change"(
    "p_user_id" uuid,
    "p_actor_id" uuid,
    "p_source" text,
    "p_action" text,
    "p_from_statuses" text[],
    "p_expected_role" text,
    "p_status" text,
    "p_role" text,
    "p_note" text,
    "p_set_tools" text[],
    "p_drop_tools" text[],
    "p_details" jsonb default '{}'::jsonb
) returns void
    language plpgsql
    volatile
    security definer
    set search_path = ''
    as $$
declare
    v_current public.dev_mcp_access%rowtype;
    v_has_row boolean;
    v_before text[];
    v_after text[];
    v_added text[];
    v_removed text[];
    v_status_changed boolean;
begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.dev_mcp_apply_change'));

    select * into v_current
    from public.dev_mcp_access a
    where a.user_id = p_user_id
    for update;
    v_has_row := found;

    if not (coalesce(v_current.status, 'none') = any (p_from_statuses)) then
        if not v_has_row then
            raise exception 'This member has no Dev MCP access request'
                using hint = 'dev_mcp_not_found';
        end if;
        raise exception 'Can''t do that to Dev MCP access that is %', v_current.status
            using hint = 'dev_mcp_conflict';
    end if;

    if p_expected_role is not null and v_current.role is distinct from p_expected_role then
        raise exception 'This member''s Dev MCP role changed in the meantime; reload and try again'
            using hint = 'dev_mcp_conflict';
    end if;

    if v_current.status = 'active' and v_current.role = 'admin'
        and not (p_status = 'active' and p_role = 'admin')
        and not exists (
            select 1
            from public.dev_mcp_access a
            where a.status = 'active'
              and a.role = 'admin'
              and a.user_id <> p_user_id
        )
    then
        raise exception 'This member is the last active Dev MCP admin; make someone else an admin first'
            using hint = 'dev_mcp_last_admin';
    end if;

    select coalesce(array_agg(g.tool order by g.tool), '{}'::text[]) into v_before
    from public.dev_mcp_tool_grants g
    where g.user_id = p_user_id;

    v_status_changed := coalesce(v_current.status, 'none') is distinct from p_status;

    insert into public.dev_mcp_access as a (
        user_id, status, role, requested_at, decided_at, decided_by, decision_note
    )
    values (p_user_id, p_status, p_role, now(), now(), p_actor_id, p_note)
    on conflict (user_id) do update set
        status = excluded.status,
        role = excluded.role,
        decided_at = excluded.decided_at,
        decided_by = excluded.decided_by,
        decision_note = case
            when a.status is distinct from excluded.status then excluded.decision_note
            else a.decision_note
        end;

    if p_status <> 'active' then
        delete from public.dev_mcp_tool_grants g where g.user_id = p_user_id;
    else
        if p_set_tools is not null then
            delete from public.dev_mcp_tool_grants g
            where g.user_id = p_user_id
              and not (g.tool = any (p_set_tools));
            insert into public.dev_mcp_tool_grants (user_id, tool, granted_by)
            select distinct p_user_id, t.tool, p_actor_id
            from unnest(p_set_tools) as t(tool)
            on conflict (user_id, tool) do nothing;
        end if;
        if p_drop_tools is not null then
            delete from public.dev_mcp_tool_grants g
            where g.user_id = p_user_id
              and g.tool = any (p_drop_tools);
        end if;
    end if;

    select coalesce(array_agg(g.tool order by g.tool), '{}'::text[]) into v_after
    from public.dev_mcp_tool_grants g
    where g.user_id = p_user_id;
    v_added := array(
        select t from unnest(v_after) as t except select t from unnest(v_before) as t order by 1
    );
    v_removed := array(
        select t from unnest(v_before) as t except select t from unnest(v_after) as t order by 1
    );

    if v_status_changed
        or v_current.role is distinct from p_role
        or cardinality(v_added) > 0
        or cardinality(v_removed) > 0
    then
        insert into public.dev_mcp_access_events (user_id, actor_id, source, action, details)
        values (
            p_user_id,
            p_actor_id,
            p_source,
            p_action,
            jsonb_build_object(
                'previous', case
                    when v_has_row then jsonb_build_object('status', v_current.status, 'role', v_current.role)
                end,
                'status', p_status,
                'role', p_role,
                'added', to_jsonb(v_added),
                'removed', to_jsonb(v_removed)
            )
            || case
                when v_status_changed and p_note is not null then jsonb_build_object('note', p_note)
                else '{}'::jsonb
            end
            || coalesce(p_details, '{}'::jsonb)
        );
    end if;
end;
$$;

comment on function "public"."dev_mcp_apply_change"(uuid, uuid, text, text, text[], text, text, text, text, text[], text[], jsonb) is
    'Applies one dev-mcp access change atomically with its event (expected status, last-admin rule, grants). Service role only.';

-- 5. OAuth: binding clients to a server, and the principal ---------------------

-- Called by the consent page (the member's browser session) before it approves
-- an authorization, and before it follows an auto-approved redirect. Reads the
-- authorization's client and RFC 8707 resource from GoTrue's own table (the
-- page never sees the resource) and binds that client to it. Binding the same
-- client to the same resource again is fine; another resource is refused, so
-- one OAuth client only ever holds tokens for one TUM.ai MCP server.
create or replace function "public"."bind_oauth_authorization"("authorization_id" text) returns void
    language plpgsql
    volatile
    security definer
    set search_path = ''
    as $$
declare
    v_user_id uuid := auth.uid();
    v_client_id uuid;
    v_resource text;
    v_bound text;
begin
    if v_user_id is null then
        raise exception 'Sign in to connect an app'
            using errcode = '42501';
    end if;
    -- Only the member's own browser session, never an app's token.
    if auth.jwt() ->> 'client_id' is not null then
        raise exception 'Apps can''t bind authorizations'
            using errcode = '42501';
    end if;

    select a.client_id, nullif(btrim(a.resource), '')
    into v_client_id, v_resource
    from auth.oauth_authorizations a
    where a.authorization_id::text = bind_oauth_authorization.authorization_id
      and a.user_id = v_user_id;

    if not found then
        raise exception 'This sign-in request wasn''t found. Start connecting again from your AI app.'
            using hint = 'oauth_authorization_not_found';
    end if;

    -- Clients that don't send RFC 8707 `resource` stay unbound. nomcp doesn't
    -- check bindings, so they keep working there; dev_mcp_principal() refuses
    -- unbound clients, so they never reach dev-mcp.
    if v_resource is null then
        return;
    end if;

    insert into public.mcp_client_resources (client_id, resource, user_id)
    values (v_client_id, v_resource, v_user_id)
    on conflict (client_id) do nothing;

    select r.resource into v_bound
    from public.mcp_client_resources r
    where r.client_id = v_client_id;

    if v_bound is distinct from v_resource then
        raise exception 'This app is already connected to another TUM.ai server. Add it again in your AI app for this one.'
            using hint = 'oauth_resource_mismatch';
    end if;
end;
$$;

comment on function "public"."bind_oauth_authorization"(text) is
    'Binds an OAuth authorization''s client to its RFC 8707 resource; errors for another resource, leaves clients without one unbound. Browser sessions only.';

-- Who a member OAuth token belongs to and their dev-mcp access, for dev-mcp
-- (`POST /rest/v1/rpc/dev_mcp_principal` with the member's token). Returns the
-- access record (see dev_mcp_access_record), or null:
--
-- - for a token without `client_id` (a browser session),
-- - once the token's session is gone (the app was disconnected or the member
--   signed out everywhere),
-- - for a client not bound to dev-mcp's resource (mcp_resource_settings
--   'dev_mcp'), e.g. one connected to nomcp,
-- - for a user without a member row, or without a TUM.ai Slack user ID (dev-mcp
--   identifies members by it).
--
-- Side effects, like mcp_principal(): an active member without a row files a
-- `requested` one on first use; `last_seen_at` and the last client are
-- refreshed at most once per minute. mcp_principal() itself is unchanged.
create or replace function "public"."dev_mcp_principal"() returns jsonb
    language plpgsql
    volatile
    security definer
    set search_path = ''
    as $$
declare
    v_user_id uuid := auth.uid();
    v_client_id text := auth.jwt() ->> 'client_id';
    v_session_id text := auth.jwt() ->> 'session_id';
    v_client_uuid uuid;
    v_member_status text;
    v_access public.dev_mcp_access%rowtype;
    v_has_row boolean;
    v_needs_request boolean;
    v_client_name text;
begin
    if v_client_id is null or v_user_id is null then
        return null;
    end if;

    if v_session_id is not null and not exists (
        select 1 from auth.sessions s where s.id = v_session_id::uuid
    ) then
        return null;
    end if;

    begin
        v_client_uuid := v_client_id::uuid;
    exception
        when invalid_text_representation then
            return null;
    end;

    if not exists (
        select 1
        from public.mcp_client_resources r
        join public.mcp_resource_settings s on s.key = 'dev_mcp' and s.resource = r.resource
        where r.client_id = v_client_uuid
    ) then
        return null;
    end if;

    select m.member_status into v_member_status
    from public.members m
    where m.user_id = v_user_id;
    if not found then
        return null;
    end if;

    if public.member_slack_user_id(v_user_id) is null then
        return null;
    end if;

    select * into v_access from public.dev_mcp_access a where a.user_id = v_user_id;
    v_has_row := found;
    -- Eligible: active, and in the TUM.ai Slack workspace (checked above).
    v_needs_request := not v_has_row and v_member_status = 'active';

    if v_needs_request or (
        v_has_row and (
            v_access.last_seen_at is null
            or v_access.last_seen_at < now() - interval '1 minute'
        )
    ) then
        begin
            select c.client_name into v_client_name
            from auth.oauth_clients c
            where c.id = v_client_uuid;
        exception
            when undefined_table or undefined_column or insufficient_privilege then
                v_client_name := null;
        end;

        if v_needs_request then
            perform public.dev_mcp_file_request(
                v_user_id,
                'oauth',
                v_user_id,
                jsonb_build_object('client_id', v_client_id, 'client_name', v_client_name)
            );
        end if;

        update public.dev_mcp_access a
        set last_seen_at = now(),
            last_client_id = v_client_id,
            last_client_name = v_client_name
        where a.user_id = v_user_id;
    end if;

    return public.dev_mcp_access_record(v_user_id);
end;
$$;

comment on function "public"."dev_mcp_principal"() is
    'The member an OAuth app token belongs to and their dev-mcp access record (contract with dev-mcp). Null unless the JWT has a client_id bound to dev-mcp''s resource.';

-- 6. Function privileges ------------------------------------------------------

revoke all on function "public"."member_slack_user_id"(uuid) from public, anon, authenticated;
grant execute on function "public"."member_slack_user_id"(uuid) to service_role;

revoke all on function "public"."dev_mcp_access_record"(uuid) from public, anon, authenticated;
grant execute on function "public"."dev_mcp_access_record"(uuid) to service_role;

revoke all on function "public"."dev_mcp_access_for"(text) from public, anon, authenticated;
grant execute on function "public"."dev_mcp_access_for"(text) to service_role;

revoke all on function "public"."dev_mcp_file_request"(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function "public"."dev_mcp_file_request"(uuid, text, uuid, jsonb) to service_role;

revoke all on function "public"."dev_mcp_apply_change"(uuid, uuid, text, text, text[], text, text, text, text, text[], text[], jsonb) from public, anon, authenticated;
grant execute on function "public"."dev_mcp_apply_change"(uuid, uuid, text, text, text[], text, text, text, text, text[], text[], jsonb) to service_role;

revoke all on function "public"."bind_oauth_authorization"(text) from public, anon, service_role;
grant execute on function "public"."bind_oauth_authorization"(text) to authenticated;

revoke all on function "public"."dev_mcp_principal"() from public, anon, service_role;
grant execute on function "public"."dev_mcp_principal"() to authenticated;
