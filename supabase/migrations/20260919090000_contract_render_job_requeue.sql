begin;

-- Retry read the job's lease in one request and reset it in another. A worker
-- claiming the job in between had its fresh lease erased and its attempt count
-- reset: it could no longer finalize, and a second worker could claim the same
-- render. The document reset was a third request, so a crash between them left
-- the row disagreeing with its job.
--
-- All of it moves into one function so the eligibility check, the job reset and
-- the dependent row reset share a transaction. `for update` serialises against
-- claim_contract_render_job, whose candidate query uses `for update skip
-- locked`: a claim in flight either skips this locked row, or wins and is then
-- visible here as a live lease, which is left untouched.
create or replace function "public"."requeue_contract_render_job"(
    p_template_document_id uuid default null,
    p_document_version_id uuid default null,
    p_include_failed boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_job public.contract_render_jobs;
begin
    if (p_template_document_id is null) = (p_document_version_id is null) then
        raise exception 'exactly one requeue target is required' using errcode = '22023';
    end if;

    select * into v_job
    from public.contract_render_jobs
    where (
            (p_template_document_id is not null
                and template_document_id = p_template_document_id)
            or (p_document_version_id is not null
                and document_version_id = p_document_version_id)
          )
      and (
            status in ('queued', 'processing')
            or (p_include_failed and status = 'failed')
          )
    order by created_at desc
    limit 1
    for update;

    if not found then
        return 'missing';
    end if;

    -- Genuinely in flight: the worker still owns it and must be left alone.
    if v_job.status = 'processing'
       and v_job.lease_expires_at is not null
       and v_job.lease_expires_at > now() then
        return 'live';
    end if;

    -- A fresh attempt budget is the point of an operator-initiated retry, and
    -- contract_render_jobs_lease_check rejects a queued row that still carries
    -- lease columns.
    update public.contract_render_jobs
    set status = 'queued',
        attempt_count = 0,
        run_after = now(),
        leased_by = null,
        lease_token = null,
        lease_expires_at = null,
        finished_at = null,
        last_error_code = null,
        last_error_message = null,
        updated_at = now()
    where id = v_job.id;

    if v_job.operation = 'template_preview' then
        update public.contract_template_documents
        set status = 'queued',
            error_code = null,
            error_message = null,
            updated_at = now()
        where id = v_job.template_document_id
          and status <> 'ready';
    else
        update public.contract_document_versions
        set artifact_status = 'queued',
            artifact_error_code = null,
            artifact_error_message = null
        where id = v_job.document_version_id
          and artifact_status <> 'ready';
    end if;

    return 'revived';
end;
$$;

revoke all on function "public"."requeue_contract_render_job"(uuid, uuid, boolean) from "public", "anon", "authenticated";
grant execute on function "public"."requeue_contract_render_job"(uuid, uuid, boolean) to "service_role";

commit;
