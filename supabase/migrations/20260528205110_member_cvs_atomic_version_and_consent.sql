begin;

-- =========================================================================
-- Hardening for member CVs:
--   1. Atomic version insert (P1). Demoting the old current row and inserting
--      the new current row must be a single, serialized operation. Doing it
--      in two client round-trips can (a) leave a member with no current CV if
--      the insert fails after the demote, and (b) race under concurrent
--      uploads (two requests compute the same next version, one demotes the
--      other's row, then hits the unique constraint). A per-user advisory lock
--      inside a function serializes uploads for the same member.
--   2. Consent audit (P2). Record WHO set partner-sharing consent so opt-in is
--      attributable. The route enforces that only the member may opt in.
-- =========================================================================

-- ---- Consent audit column ---------------------------------------------------
alter table "public"."members"
    add column if not exists "partner_sharing_consented_by_user_id" uuid
        references "auth"."users"("id") on delete set null;

comment on column "public"."members"."partner_sharing_consented_by_user_id" is
    'Who set partner_sharing_consent_at. For GDPR-grade opt-in only the member themselves may set consent; admins may at most clear it.';

-- ---- Atomic CV version insert ----------------------------------------------
-- The object is uploaded to storage by the caller first (named by p_id). This
-- function performs only the metadata flip, atomically:
--   - takes a transaction-scoped advisory lock keyed by user_id
--   - computes the next version from the current max
--   - demotes any current row
--   - inserts the new current row
-- Runs as SECURITY DEFINER so it is callable by service_role exclusively
-- (see grants). On any failure the whole function rolls back, so the previous
-- current row is preserved.
create or replace function "public"."insert_member_cv_version"(
    p_id uuid,
    p_user_id uuid,
    p_storage_bucket text,
    p_storage_path text,
    p_original_filename text,
    p_mime_type text,
    p_size_bytes integer,
    p_sha256 text,
    p_source text,
    p_uploaded_by_user_id uuid
)
returns "public"."member_cvs"
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prev_id uuid;
    v_next_version integer;
    v_row public.member_cvs;
begin
    -- Serialize concurrent uploads for the same member within this tx.
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    select id, version
      into v_prev_id, v_next_version
      from public.member_cvs
     where user_id = p_user_id
     order by version desc
     limit 1;

    v_next_version := coalesce(v_next_version, 0) + 1;

    update public.member_cvs
       set is_current = false
     where user_id = p_user_id
       and is_current = true;

    insert into public.member_cvs (
        id, user_id, storage_bucket, storage_path, original_filename,
        mime_type, size_bytes, sha256, source, version, is_current,
        uploaded_by_user_id, supersedes_cv_id
    ) values (
        p_id, p_user_id, p_storage_bucket, p_storage_path, p_original_filename,
        p_mime_type, p_size_bytes, p_sha256, p_source, v_next_version, true,
        p_uploaded_by_user_id, v_prev_id
    )
    returning * into v_row;

    return v_row;
end;
$$;

revoke all on function "public"."insert_member_cv_version"(
    uuid, uuid, text, text, text, text, integer, text, text, uuid
) from "public", "anon", "authenticated";

grant execute on function "public"."insert_member_cv_version"(
    uuid, uuid, text, text, text, text, integer, text, text, uuid
) to "service_role";

commit;
