-- Admin approval for nomcp (`tum-ai/nomcp`, the TUM.ai Notion MCP).
--
-- Until now every active member of the TUM.ai Slack workspace could use nomcp
-- as soon as they connected an AI app. Now an admin approves each member, as
-- a `reader` or an `editor`, on member-manager's /admin/mcp-access page.
--
-- - `public.mcp_access` holds one row per member who asked for access (or was
--   let in): pending, approved with a role, or denied.
-- - `public.mcp_principal()`, which nomcp calls for every new token, adds
--   `access_status` and `access_role` (contract v2). It also files the pending
--   request the first time an eligible member connects, and records when and
--   with which app a member last used nomcp. Writing makes it VOLATILE, so
--   PostgREST runs `POST /rpc/mcp_principal` read-write.
-- - Everyone who is an admin when this runs is approved as an editor, so the
--   people who approve others aren't locked out.
--
-- Apply this before the nomcp release that reads `access_status`; the old
-- function doesn't return it.

create table if not exists "public"."mcp_access" (
    "user_id" uuid primary key
        references "public"."members" ("user_id") on delete cascade,
    "status" text not null default 'pending'
        check ("status" in ('pending', 'approved', 'denied')),
    "role" text check ("role" in ('reader', 'editor')),
    "requested_at" timestamptz not null default now(),
    "decided_at" timestamptz,
    "decided_by" uuid references "auth"."users" ("id") on delete set null,
    "decision_note" text
        check ("decision_note" is null or char_length("decision_note") <= 500),
    "last_seen_at" timestamptz,
    "last_client_id" text,
    "last_client_name" text,
    -- An approved member always has a role; nobody else has one.
    constraint "mcp_access_role_only_when_approved"
        check (("status" = 'approved') = ("role" is not null))
);

comment on table "public"."mcp_access" is
    'nomcp (TUM.ai Notion MCP) access per member, decided by admins. Written by the API and public.mcp_principal().';
comment on column "public"."mcp_access"."role" is
    'nomcp role while approved: reader (read tools) or editor (read and write tools).';
comment on column "public"."mcp_access"."decided_by" is
    'Admin who made the last decision; null for the automatic approval of admins in this migration.';
comment on column "public"."mcp_access"."decision_note" is
    'Admin-only note on the last decision (e.g. why access was denied). Not visible to the member.';
comment on column "public"."mcp_access"."last_seen_at" is
    'Last nomcp sign-in check (mcp_principal), updated at most once per minute.';
comment on column "public"."mcp_access"."last_client_id" is
    'client_id claim of the OAuth app the member last used (auth.oauth_clients.id).';

alter table "public"."mcp_access" enable row level security;

-- The default privileges grant every new table to anon and authenticated.
-- Members may read their own status, but not who decided or the admin's note;
-- everything else goes through the API (service role) and mcp_principal().
revoke all on table "public"."mcp_access" from public, anon, authenticated;
grant select (
    "user_id",
    "status",
    "role",
    "requested_at",
    "decided_at",
    "last_seen_at",
    "last_client_id",
    "last_client_name"
) on table "public"."mcp_access" to authenticated;
grant select, insert, update, delete on table "public"."mcp_access" to service_role;

create policy "Members can view own nomcp access" on "public"."mcp_access"
    for select to authenticated
    using ((select auth.uid()) = "user_id");

create policy "oauth_clients_blocked" on "public"."mcp_access" as restrictive for all to authenticated
    using ((select auth.jwt() ->> 'client_id') is null)
    with check ((select auth.jwt() ->> 'client_id') is null);

-- Today's admins start out approved as editors. supabase/seed.sql repeats this
-- for the local stack, whose admins are seeded after migrations run.
insert into "public"."mcp_access" ("user_id", "status", "role", "requested_at", "decided_at", "decision_note")
select distinct r."user_id", 'approved', 'editor', now(), now(),
    'Approved automatically: admin when nomcp access approval was introduced'
from "public"."user_roles" r
join "public"."members" m on m."user_id" = r."user_id"
where r."role" = 'admin'
on conflict ("user_id") do nothing;

-- Contract v2. Same call and the same null cases as before (no `client_id`, a
-- revoked or signed-out session, no member row); the result gains
-- `access_status` (pending | approved | denied) and `access_role` (reader |
-- editor while approved, otherwise null).
--
-- Side effects:
-- - An active member of the TUM.ai Slack workspace without a row gets a
--   `pending` one. Anyone else gets no row and reads `pending`; nomcp denies
--   them on member_status / slack_team_ok anyway.
-- - `last_seen_at` and the last client are refreshed at most once per minute.
--
-- The client name comes from GoTrue's `auth.oauth_clients`. That table belongs
-- to the auth server, so a missing table or column only loses the name.
create or replace function "public"."mcp_principal"() returns jsonb
    language plpgsql
    volatile
    security definer
    set search_path = ''
    as $$
declare
    v_user_id uuid := auth.uid();
    v_client_id text := auth.jwt() ->> 'client_id';
    v_session_id text := auth.jwt() ->> 'session_id';
    v_principal jsonb;
    v_access public.mcp_access%rowtype;
    v_has_row boolean;
    v_eligible boolean;
    v_needs_insert boolean;
    v_needs_touch boolean;
    v_client_name text;
begin
    if v_client_id is null or v_user_id is null then
        return null;
    end if;

    -- Revoking the app's grant (or signing out everywhere) deletes its
    -- session; its access tokens stay valid until they expire, so check.
    if v_session_id is not null and not exists (
        select 1 from auth.sessions s where s.id = v_session_id::uuid
    ) then
        return null;
    end if;

    select jsonb_build_object(
        'user_id', m.user_id,
        'display_name', coalesce(
            nullif(btrim(concat_ws(' ', btrim(m.given_name), btrim(m.surname))), ''),
            nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
            nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
        ),
        'email', u.email,
        'member_status', m.member_status,
        'slack_team_ok', exists (
            select 1
            from auth.identities i
            where i.user_id = m.user_id
              and i.provider = 'slack_oidc'
              and btrim(i.identity_data -> 'custom_claims' ->> 'https://slack.com/team_id') = 'T01288YLP16'
        )
    )
    into v_principal
    from public.members m
    left join auth.users u on u.id = m.user_id
    where m.user_id = v_user_id;

    if v_principal is null then
        return null;
    end if;

    select * into v_access from public.mcp_access a where a.user_id = v_user_id;
    v_has_row := found;
    v_eligible := v_principal ->> 'member_status' = 'active'
        and (v_principal ->> 'slack_team_ok')::boolean;
    v_needs_insert := not v_has_row and v_eligible;
    v_needs_touch := v_has_row and (
        v_access.last_seen_at is null
        or v_access.last_seen_at < now() - interval '1 minute'
    );

    if v_needs_insert or v_needs_touch then
        begin
            select c.client_name into v_client_name
            from auth.oauth_clients c
            where c.id = v_client_id::uuid;
        exception
            when undefined_table or undefined_column or insufficient_privilege
                or invalid_text_representation then
                v_client_name := null;
        end;
    end if;

    if v_needs_insert then
        insert into public.mcp_access (
            user_id, status, requested_at, last_seen_at, last_client_id, last_client_name
        )
        values (v_user_id, 'pending', now(), now(), v_client_id, v_client_name)
        on conflict (user_id) do nothing;
        select * into v_access from public.mcp_access a where a.user_id = v_user_id;
    elsif v_needs_touch then
        update public.mcp_access a
        set last_seen_at = now(),
            last_client_id = v_client_id,
            last_client_name = v_client_name
        where a.user_id = v_user_id
        returning * into v_access;
    end if;

    return v_principal || jsonb_build_object(
        'access_status', coalesce(v_access.status, 'pending'),
        'access_role', case when v_access.status = 'approved' then v_access.role end
    );
end;
$$;

comment on function "public"."mcp_principal"() is
    'The member an OAuth app token belongs to and their nomcp access (contract v2). Null unless the JWT has client_id.';

revoke all on function "public"."mcp_principal"() from public, anon;
grant execute on function "public"."mcp_principal"() to authenticated;
