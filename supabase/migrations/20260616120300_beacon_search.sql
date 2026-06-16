begin;

-- =========================================================================
-- Beacon Phase 5 — NL search support.
--   * beacon_search_log: GDPR audit of queries (admin-readable; server writes).
--   * beacon_hybrid_search(): dense (pgvector) + sparse (tsvector) retrieval over
--     beacon_search_chunk, fused with Reciprocal Rank Fusion (RRF, k≈60),
--     reduced to the best chunk per person. Degrades to sparse-only when no
--     query embedding is supplied (e.g. OPENAI_API_KEY absent).
-- =========================================================================

create table if not exists "public"."beacon_search_log" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid references "public"."members"("user_id") on delete set null,
    "query" text not null,
    "dsl" jsonb,
    "result_count" integer not null default 0,
    "created_at" timestamptz not null default now()
);
create index if not exists "beacon_search_log_created_idx"
    on "public"."beacon_search_log" ("created_at" desc);

alter table "public"."beacon_search_log" enable row level security;
drop policy if exists "Admins read search log" on "public"."beacon_search_log";
create policy "Admins read search log"
    on "public"."beacon_search_log" as permissive for select to authenticated
    using ("public"."beacon_is_admin"());
revoke all on table "public"."beacon_search_log" from anon;
grant all on table "public"."beacon_search_log" to service_role;

-- Hybrid retrieval + RRF. q_embedding is passed as a text vector literal
-- ('[..]') or null; candidate_ids restricts to a structured-filter candidate set
-- (null = no restriction).
create or replace function "public"."beacon_hybrid_search"(
    q_embedding text default null,
    q_text text default '',
    candidate_ids uuid[] default null,
    match_limit integer default 20,
    rrf_k integer default 60
)
returns table(user_id uuid, score real, best_chunk text, best_kind text)
language sql
stable
set search_path = public, extensions
as $$
    with dense as (
        select c.user_id, c.content, c.kind,
               row_number() over (order by c.embedding <=> q_embedding::vector) as rnk
        from beacon_search_chunk c
        where q_embedding is not null
          and c.embedding is not null
          and (candidate_ids is null or c.user_id = any(candidate_ids))
        order by c.embedding <=> q_embedding::vector
        limit 100
    ),
    q as (
        -- OR the lexemes (plainto_tsquery ANDs them, killing recall for
        -- multi-concept queries). RRF re-ranks afterward.
        select nullif(
            replace(plainto_tsquery('english', q_text)::text, '&', '|'),
            ''
        )::tsquery as orq
    ),
    sparse as (
        select c.user_id, c.content, c.kind,
               row_number() over (order by ts_rank(c.lexeme, q.orq) desc) as rnk
        from beacon_search_chunk c, q
        where q.orq is not null
          and c.lexeme @@ q.orq
          and (candidate_ids is null or c.user_id = any(candidate_ids))
        order by ts_rank(c.lexeme, q.orq) desc
        limit 100
    ),
    fused as (
        select user_id, content, kind, 1.0 / (rrf_k + rnk) as s from dense
        union all
        select user_id, content, kind, 1.0 / (rrf_k + rnk) as s from sparse
    ),
    per_chunk as (
        select user_id, content, kind, sum(s) as s
        from fused group by user_id, content, kind
    ),
    ranked as (
        select user_id, content, kind,
               row_number() over (partition by user_id order by s desc) as chunk_rank,
               sum(s) over (partition by user_id) as person_score
        from per_chunk
    )
    select user_id, person_score::real as score, content as best_chunk, kind as best_kind
    from ranked
    where chunk_rank = 1
    order by person_score desc
    limit match_limit;
$$;

revoke all on function "public"."beacon_hybrid_search"(text, text, uuid[], integer, integer) from anon;
grant execute on function "public"."beacon_hybrid_search"(text, text, uuid[], integer, integer) to service_role, authenticated;

commit;
