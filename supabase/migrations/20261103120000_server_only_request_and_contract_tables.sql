-- Server-only access to tables whose rows the API trusts.
--
-- These tables kept the browser grants and policies from their first
-- migrations: a member could INSERT rows straight through PostgREST with any
-- column values, and read every column of their own rows, contract signing
-- tokens included. The API writes all of them with the service role and later
-- acts on what it reads back, so a direct insert or read let a member:
--   * forge a contract submission in a signed state with tokens they chose,
--     then have it board-signed and sent without Legal & Finance review;
--   * read the board signing token of their own submission and sign as the
--     board;
--   * add member columns to a change request (educational_course_role,
--     board_role, active) that the admin review card doesn't show and the
--     approval then applied;
--   * file an engagement certificate request that is already approved.
--
-- No browser code reads or writes these tables; every path goes through /api.
-- Browser roles lose all access, the service role keeps its grants, and the
-- restrictive "oauth_clients_blocked" policies from 20261102120000 stay.
-- contract_document_versions and contract_status_events go too: their member
-- policies look up contract_submissions, which browser roles can no longer read.

begin;

-- contract_submissions -------------------------------------------------------
drop policy if exists "Submitters insert own submissions" on "public"."contract_submissions";
drop policy if exists "Submitters read own submissions" on "public"."contract_submissions";
drop policy if exists "L&F manage submissions" on "public"."contract_submissions";
revoke all on table "public"."contract_submissions" from "public", "anon", "authenticated";

-- contract_document_versions -------------------------------------------------
drop policy if exists "L&F manage contract document versions" on "public"."contract_document_versions";
drop policy if exists "Submitters read own contract document versions" on "public"."contract_document_versions";
revoke all on table "public"."contract_document_versions" from "public", "anon", "authenticated";

-- contract_status_events -----------------------------------------------------
drop policy if exists "Contracts admins read status events" on "public"."contract_status_events";
revoke all on table "public"."contract_status_events" from "public", "anon", "authenticated";

-- member_change_requests -----------------------------------------------------
drop policy if exists "Admins manage member change requests" on "public"."member_change_requests";
drop policy if exists "Members insert own change requests" on "public"."member_change_requests";
drop policy if exists "Members read own change requests" on "public"."member_change_requests";
revoke all on table "public"."member_change_requests" from "public", "anon", "authenticated";

-- engagement_certificate_requests --------------------------------------------
drop policy if exists "Admins manage engagement certificate requests" on "public"."engagement_certificate_requests";
drop policy if exists "Members insert own engagement certificate requests" on "public"."engagement_certificate_requests";
drop policy if exists "Members read own engagement certificate requests" on "public"."engagement_certificate_requests";
revoke all on table "public"."engagement_certificate_requests" from "public", "anon", "authenticated";

-- Fail the migration if a browser role still holds any privilege on them
-- (has_table_privilege also counts grants to PUBLIC).
do $$
declare
    leaked text;
begin
    select string_agg(format('%s on %s', r.role_name, t.table_name), ', ')
    into leaked
    from unnest(array[
        'contract_submissions',
        'contract_document_versions',
        'contract_status_events',
        'member_change_requests',
        'engagement_certificate_requests'
    ]) as t(table_name)
    cross join unnest(array['anon', 'authenticated']) as r(role_name)
    where has_table_privilege(
        r.role_name,
        format('public.%I', t.table_name),
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    );
    if leaked is not null then
        raise exception 'browser roles still hold privileges: %', leaked;
    end if;
end;
$$;

commit;
