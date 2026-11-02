-- Supabase Auth's OAuth 2.1 server lets other apps sign members in with their
-- member-manager account. Its first client is nomcp (`tum-ai/nomcp`), the
-- TUM.ai Notion MCP gateway that members' AI agents (claude.ai, ChatGPT,
-- Claude Code, ...) connect to. The consent screen is the SPA route
-- `/oauth/consent`.
--
-- An access token issued to such an app is an ordinary `authenticated` user
-- JWT plus a `client_id` claim. Without this migration the app could read and
-- write member-manager data through PostgREST and Storage as that member,
-- admins included. So:
--
-- 1. Every RLS-enabled table in `public`, and `storage.objects`, gets the
--    restrictive policy `oauth_clients_blocked`: a row is only visible or
--    writable when the JWT has no `client_id`. Postgres ANDs restrictive
--    policies with the permissive ones, so browser sessions keep exactly the
--    access they had, and the service role (which bypasses RLS) is unaffected.
--    Every table created after this migration must add the same policy;
--    `server/test/migrations/mcpOauthMigration.test.ts` fails otherwise.
-- 2. `public.mcp_principal()` is what an app token may still read: who the
--    token belongs to, for nomcp's access check.
--
-- The Fastify API rejects tokens that carry `client_id` on its own
-- (`server/src/middleware/auth.ts`). Enable the OAuth server in the hosted
-- project only after this migration is live (docs/deployment.md).

do $$
declare
    target record;
begin
    for target in
        select n.nspname as schema_name, c.relname as table_name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r', 'p')
          and c.relrowsecurity
          and (
              n.nspname = 'public'
              or (n.nspname = 'storage' and c.relname = 'objects')
          )
        order by n.nspname, c.relname
    loop
        execute format(
            'create policy "oauth_clients_blocked" on %I.%I as restrictive for all to authenticated '
            'using ((select auth.jwt() ->> ''client_id'') is null) '
            'with check ((select auth.jwt() ->> ''client_id'') is null)',
            target.schema_name,
            target.table_name
        );
    end loop;
end;
$$;

-- Who an OAuth app token belongs to, for nomcp. nomcp calls
-- `POST /rest/v1/rpc/mcp_principal` with the member's token and decides
-- access from the result (it requires an active member of the TUM.ai Slack
-- workspace). It returns null for a token without `client_id` (a browser
-- session has no use for it), for a token whose session was revoked or
-- signed out, and for a user without a member row.
--
-- `slack_team_ok` reads the auth server's `auth.identities` row, never
-- `user_metadata`, which users can rewrite. The team ID matches
-- `TUMAI_SLACK_TEAM_ID` in `server/src/lib/slackWorkspace.ts` and
-- `handle_new_user` (migration 20261101120000).
create or replace function "public"."mcp_principal"() returns jsonb
    language sql
    stable
    security definer
    set search_path = ''
    as $$
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
    from public.members m
    left join auth.users u on u.id = m.user_id
    where (select auth.jwt() ->> 'client_id') is not null
      and m.user_id = (select auth.uid())
      -- Revoking the app's grant (or signing out everywhere) deletes its
      -- session; its access tokens stay valid until they expire, so check.
      and (
          (select auth.jwt() ->> 'session_id') is null
          or exists (
              select 1
              from auth.sessions s
              where s.id = ((select auth.jwt() ->> 'session_id'))::uuid
          )
      )
$$;

comment on function "public"."mcp_principal"() is
    'The member an OAuth app token belongs to, for nomcp (TUM.ai Notion MCP). Null unless the JWT has client_id.';

revoke all on function "public"."mcp_principal"() from public, anon;
grant execute on function "public"."mcp_principal"() to authenticated;
