begin;

-- =========================================================================
-- Beacon — agent activity log.
--   Full per-turn trace of what the assistant did (model rounds, tool calls
--   with complete args/results, harvested people, timings, final answer).
--   Written server-side with the service role; readable only by admins so
--   they can inspect & download a chat's reasoning from the chat page.
-- =========================================================================

create table if not exists "public"."beacon_agent_log" (
    "id" uuid primary key default gen_random_uuid(),
    "chat_id" uuid not null,
    "turn_id" uuid not null,
    "user_id" uuid references "public"."members"("user_id") on delete set null,
    "query" text not null,
    "model" text,
    "trace" jsonb not null,
    "step_count" integer not null default 0,
    "people_count" integer not null default 0,
    "duration_ms" integer,
    "created_at" timestamptz not null default now()
);
create index if not exists "beacon_agent_log_chat_idx"
    on "public"."beacon_agent_log" ("chat_id", "created_at");

alter table "public"."beacon_agent_log" enable row level security;
drop policy if exists "Admins read agent log" on "public"."beacon_agent_log";
create policy "Admins read agent log"
    on "public"."beacon_agent_log" as permissive for select to authenticated
    using ("public"."beacon_is_admin"());
revoke all on table "public"."beacon_agent_log" from anon;
grant all on table "public"."beacon_agent_log" to service_role;

commit;
