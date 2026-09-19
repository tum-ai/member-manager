begin;

-- Two ways a failing render job hides from the people operating it.
--
-- 1. Every non-terminal retry reset the target row to 'queued' AND cleared the
--    error, so a converter that fails identically on all five attempts reads as
--    a patient "Queued" until the attempts run out. That is how the production
--    "DOMMatrix is not defined" failure looked like a slow queue for weeks.
--    The error is now preserved while the job waits for its next attempt.
--
-- 2. `attempt_count` is consumed at claim time, not at finalize. A worker killed
--    mid-job (the function has a 300s limit) burns an attempt and leaves the row
--    'processing'. After max_attempts such kills the claim filter
--    (attempt_count < max_attempts) skips it forever: never retried, never
--    marked failed, and counted as a healthy backlog by the readiness endpoint.
--    Those abandoned jobs are now reaped into a terminal failure.

create or replace function "public"."expire_contract_render_jobs"()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_job public.contract_render_jobs;
    v_count integer := 0;
    v_message constant text :=
        'Render worker stopped before finishing and no attempts remain';
begin
    for v_job in
        select *
        from public.contract_render_jobs
        where status = 'processing'
          and lease_expires_at is not null
          and lease_expires_at < now()
          and attempt_count >= max_attempts
        order by lease_expires_at
        for update skip locked
    loop
        -- `contract_render_jobs_lease_check` requires lease_token to survive on a
        -- finished row, so only the liveness columns are cleared here.
        update public.contract_render_jobs
        set status = 'failed',
            leased_by = null,
            lease_expires_at = null,
            last_error_code = 'CONTRACT_RENDER_LEASE_LOST',
            last_error_message = v_message,
            finished_at = now(),
            updated_at = now()
        where id = v_job.id;

        if v_job.operation = 'template_preview' then
            update public.contract_template_documents
            set status = 'failed',
                error_code = 'CONTRACT_RENDER_LEASE_LOST',
                error_message = v_message,
                updated_at = now()
            where id = v_job.template_document_id
              and status <> 'ready';
        else
            update public.contract_document_versions
            set artifact_status = 'failed',
                artifact_error_code = 'CONTRACT_RENDER_LEASE_LOST',
                artifact_error_message = v_message
            where id = v_job.document_version_id
              and artifact_status <> 'ready';
        end if;

        v_count := v_count + 1;
    end loop;
    return v_count;
end;
$$;

create or replace function "public"."claim_contract_render_job"(
    p_worker_id text,
    p_lease_seconds integer default 300
)
returns setof "public"."contract_render_jobs"
language plpgsql
security definer
set search_path = public
as $$
declare
    v_job public.contract_render_jobs;
begin
    if nullif(btrim(p_worker_id), '') is null then
        raise exception 'worker id is required' using errcode = '22023';
    end if;
    if p_lease_seconds < 30 or p_lease_seconds > 3600 then
        raise exception 'lease seconds must be between 30 and 3600' using errcode = '22023';
    end if;

    -- Runs every cron tick, so an abandoned job surfaces as failed within a
    -- minute instead of sitting in 'processing' forever.
    perform public.expire_contract_render_jobs();

    with candidate as (
        select id
        from public.contract_render_jobs
        where attempt_count < max_attempts
          and run_after <= now()
          and (
              status = 'queued'
              or (status = 'processing' and lease_expires_at < now())
          )
        order by run_after, created_at
        for update skip locked
        limit 1
    )
    update public.contract_render_jobs j
    set status = 'processing',
        attempt_count = j.attempt_count + 1,
        leased_by = p_worker_id,
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        last_error_code = null,
        last_error_message = null,
        updated_at = now()
    from candidate
    where j.id = candidate.id
    returning j.* into v_job;

    if not found then
        return;
    end if;

    if v_job.operation = 'template_preview' then
        update public.contract_template_documents
        set status = 'processing', error_code = null, error_message = null,
            updated_at = now()
        where id = v_job.template_document_id
          and status in ('queued', 'processing');
    else
        update public.contract_document_versions
        set artifact_status = 'processing', artifact_error_code = null,
            artifact_error_message = null
        where id = v_job.document_version_id
          and artifact_status in ('queued', 'processing');
    end if;

    return next v_job;
    return;
end;
$$;

create or replace function "public"."finalize_contract_render_job"(
    p_job_id uuid,
    p_lease_token uuid,
    p_succeeded boolean,
    p_converter_version text default null,
    p_docx_path text default null,
    p_docx_size_bytes bigint default null,
    p_docx_sha256 text default null,
    p_pdf_path text default null,
    p_pdf_size_bytes bigint default null,
    p_pdf_sha256 text default null,
    p_page_count integer default null,
    p_signature_anchors jsonb default null,
    p_preview_path text default null,
    p_preview_size_bytes bigint default null,
    p_preview_sha256 text default null,
    p_validation_issues jsonb default null,
    p_error_code text default null,
    p_error_message text default null,
    p_terminal boolean default false
)
returns "public"."contract_render_jobs"
language plpgsql
security definer
set search_path = public
as $$
declare
    v_job public.contract_render_jobs;
    v_template_id uuid;
    v_active_document_id uuid;
begin
    select * into v_job
    from public.contract_render_jobs
    where id = p_job_id and status = 'processing' and lease_token = p_lease_token
    for update;
    if not found then
        raise exception 'active render job lease not found' using errcode = 'P0002';
    end if;
    if v_job.lease_expires_at < now() then
        raise exception 'render job lease expired' using errcode = '55000';
    end if;

    if p_succeeded then
        if nullif(btrim(p_converter_version), '') is null then
            raise exception 'converter version is required' using errcode = '22023';
        end if;
        if v_job.operation = 'template_preview' then
            update public.contract_template_documents
            set status = 'ready', preview_bucket = 'contract-render-artifacts',
                preview_path = p_preview_path, preview_size_bytes = p_preview_size_bytes,
                preview_sha256 = lower(p_preview_sha256),
                validation_issues = coalesce(p_validation_issues, '[]'::jsonb),
                signature_anchors = coalesce(p_signature_anchors, signature_anchors),
                converter_version = p_converter_version,
                error_code = null, error_message = null, updated_at = now()
            where id = v_job.template_document_id;

            select template_id into v_template_id
            from public.contract_template_documents
            where id = v_job.template_document_id;
            perform pg_advisory_xact_lock(hashtextextended(v_template_id::text, 0));
            select active_document_id into v_active_document_id
            from public.contract_templates
            where id = v_template_id
            for update;
            if v_active_document_id is null then
                perform public.activate_contract_template_document(
                    v_template_id,
                    v_job.template_document_id
                );
            end if;
        else
            update public.contract_document_versions
            set artifact_status = 'ready',
                docx_bucket = case when p_docx_path is null then null else 'contract-render-artifacts' end,
                docx_path = p_docx_path, docx_size_bytes = p_docx_size_bytes,
                docx_sha256 = lower(p_docx_sha256),
                pdf_bucket = case when p_pdf_path is null then null else 'contract-render-artifacts' end,
                pdf_path = p_pdf_path, pdf_size_bytes = p_pdf_size_bytes,
                pdf_sha256 = lower(p_pdf_sha256), page_count = p_page_count,
                signature_anchors = coalesce(p_signature_anchors, signature_anchors),
                converter_version = p_converter_version,
                artifact_error_code = null, artifact_error_message = null
            where id = v_job.document_version_id;

            if v_job.operation = 'partner_signature' then
                update public.contract_submissions
                set status = 'partner_signed', signed_at = now(),
                    signature_token = null, signature_token_expires_at = null,
                    updated_at = now()
                where id = v_job.submission_id;
            elsif v_job.operation = 'board_signature' then
                update public.contract_submissions
                set status = 'board_signed', admin_signed_at = now(),
                    board_signature_token = null,
                    board_signature_token_expires_at = null,
                    updated_at = now()
                where id = v_job.submission_id;
            elsif v_job.operation = 'opensign_ingest' then
                update public.contract_submissions
                set status = 'partner_signed', signed_at = now(),
                    opensign_completed_at = now(),
                    signature_token = null, signature_token_expires_at = null,
                    updated_at = now()
                where id = v_job.submission_id;
            end if;
        end if;
    else
        if nullif(btrim(p_error_code), '') is null or nullif(btrim(p_error_message), '') is null then
            raise exception 'error code and message are required' using errcode = '22023';
        end if;
        if not p_terminal and v_job.attempt_count < v_job.max_attempts then
            if v_job.operation = 'template_preview' then
                update public.contract_template_documents
                set status = 'queued', error_code = p_error_code,
                    error_message = p_error_message, updated_at = now()
                where id = v_job.template_document_id;
            else
                update public.contract_document_versions
                set artifact_status = 'queued', artifact_error_code = p_error_code,
                    artifact_error_message = p_error_message
                where id = v_job.document_version_id;
            end if;

            update public.contract_render_jobs
            set status = 'queued', run_after = now() + make_interval(
                    secs => least(300, 5 * (2 ^ greatest(attempt_count - 1, 0)))::integer
                ),
                leased_by = null, lease_token = null, lease_expires_at = null,
                last_error_code = p_error_code,
                last_error_message = p_error_message,
                updated_at = now(), finished_at = null
            where id = p_job_id
            returning * into v_job;
            return v_job;
        elsif v_job.operation = 'template_preview' then
            update public.contract_template_documents
            set status = 'failed', error_code = p_error_code,
                error_message = p_error_message, updated_at = now()
            where id = v_job.template_document_id;
        else
            update public.contract_document_versions
            set artifact_status = 'failed', artifact_error_code = p_error_code,
                artifact_error_message = p_error_message
            where id = v_job.document_version_id;

            if v_job.operation in ('partner_signature', 'board_signature', 'opensign_ingest') then
                update public.contract_submissions
                set active_document_version_id = (
                        select parent_document_version_id
                        from public.contract_document_versions
                        where id = v_job.document_version_id
                    ),
                    updated_at = now()
                where id = v_job.submission_id;
            end if;
        end if;
    end if;

    update public.contract_render_jobs
    set status = case when p_succeeded then 'succeeded' else 'failed' end,
        last_error_code = case when p_succeeded then null else p_error_code end,
        last_error_message = case when p_succeeded then null else p_error_message end,
        finished_at = now(), updated_at = now()
    where id = p_job_id
    returning * into v_job;
    return v_job;
end;
$$;

-- `create or replace` keeps the existing ACLs on the two replaced functions;
-- restating them keeps the privilege set visible in one place.
revoke all on function "public"."expire_contract_render_jobs"() from "public", "anon", "authenticated";
revoke all on function "public"."claim_contract_render_job"(text, integer) from "public", "anon", "authenticated";
grant execute on function "public"."expire_contract_render_jobs"() to "service_role";
grant execute on function "public"."claim_contract_render_job"(text, integer) to "service_role";

commit;
