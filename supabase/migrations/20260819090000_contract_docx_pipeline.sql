begin;

-- DOCX sources and rendered artifacts are encrypted by the application before
-- upload. Storage therefore sees only opaque octet streams in private buckets.
insert into "storage"."buckets" (
    "id", "name", "public", "file_size_limit", "allowed_mime_types"
)
values
    (
        'contract-template-documents',
        'contract-template-documents',
        false,
        20971520,
        array['application/octet-stream']
    ),
    (
        'contract-render-artifacts',
        'contract-render-artifacts',
        false,
        52428800,
        array['application/octet-stream']
    )
on conflict ("id") do update set
    "public" = excluded."public",
    "file_size_limit" = excluded."file_size_limit",
    "allowed_mime_types" = excluded."allowed_mime_types";

-- No storage.objects policies are added. Every upload, download, and signed URL
-- is mediated by the server with the service role.

create table "public"."contract_template_documents" (
    "id" uuid primary key default gen_random_uuid(),
    "template_id" uuid not null references "public"."contract_templates"("id") on delete restrict,
    "version" integer not null,
    "status" text not null default 'queued',
    "source_bucket" text not null default 'contract-template-documents',
    "source_path" text not null,
    "source_size_bytes" bigint not null,
    "source_sha256" text not null,
    "original_filename" text not null,
    "preview_bucket" text,
    "preview_path" text,
    "preview_size_bytes" bigint,
    "preview_sha256" text,
    "placeholder_manifest" jsonb not null default '{}'::jsonb,
    "validation_issues" jsonb not null default '[]'::jsonb,
    "signature_anchors" jsonb not null default '[]'::jsonb,
    "converter_version" text,
    "error_code" text,
    "error_message" text,
    "uploaded_by_user_id" uuid references "auth"."users"("id") on delete set null,
    "activated_at" timestamptz,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "contract_template_documents_version_positive_check"
        check ("version" > 0),
    constraint "contract_template_documents_status_check"
        check ("status" in ('queued', 'processing', 'ready', 'failed')),
    constraint "contract_template_documents_source_bucket_check"
        check ("source_bucket" = 'contract-template-documents'),
    constraint "contract_template_documents_source_size_check"
        check ("source_size_bytes" > 0 and "source_size_bytes" <= 20971520),
    constraint "contract_template_documents_source_sha256_check"
        check ("source_sha256" ~ '^[0-9a-f]{64}$'),
    constraint "contract_template_documents_source_path_check"
        check (length(btrim("source_path")) > 0 and "source_path" !~ '(^|/)\.\.(/|$)'),
    constraint "contract_template_documents_preview_tuple_check"
        check (
            ("preview_bucket" is null and "preview_path" is null and "preview_size_bytes" is null and "preview_sha256" is null)
            or (
                "preview_bucket" = 'contract-render-artifacts'
                and length(btrim("preview_path")) > 0
                and "preview_path" !~ '(^|/)\.\.(/|$)'
                and "preview_size_bytes" > 0
                and "preview_size_bytes" <= 52428800
                and "preview_sha256" ~ '^[0-9a-f]{64}$'
            )
        ),
    constraint "contract_template_documents_json_shapes_check"
        check (
            jsonb_typeof("placeholder_manifest") = 'object'
            and jsonb_typeof("validation_issues") = 'array'
            and jsonb_typeof("signature_anchors") = 'array'
        ),
    constraint "contract_template_documents_terminal_state_check"
        check (
            (
                "status" = 'ready'
                and "preview_path" is not null
                and nullif(btrim("converter_version"), '') is not null
                and "error_code" is null
                and "error_message" is null
            )
            or (
                "status" = 'failed'
                and nullif(btrim("error_code"), '') is not null
                and nullif(btrim("error_message"), '') is not null
            )
            or "status" in ('queued', 'processing')
        ),
    constraint "contract_template_documents_template_version_unique"
        unique ("template_id", "version"),
    constraint "contract_template_documents_id_template_unique"
        unique ("id", "template_id"),
    constraint "contract_template_documents_source_object_unique"
        unique ("source_bucket", "source_path")
);

create unique index "contract_template_documents_preview_object_idx"
    on "public"."contract_template_documents" ("preview_bucket", "preview_path")
    where "preview_path" is not null;

alter table "public"."contract_templates"
    add column "renderer_engine" text not null default 'legacy_text',
    add column "active_document_id" uuid;

alter table "public"."contract_templates"
    add constraint "contract_templates_renderer_engine_check"
        check ("renderer_engine" in ('legacy_text', 'docx')),
    add constraint "contract_templates_active_document_fk"
        foreign key ("active_document_id", "id")
        references "public"."contract_template_documents"("id", "template_id")
        on delete restrict;

create table "public"."contract_pipeline_settings" (
    "singleton" boolean primary key default true,
    "new_submission_engine" text not null default 'legacy_text',
    "updated_by_user_id" uuid references "auth"."users"("id") on delete set null,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "contract_pipeline_settings_singleton_check" check ("singleton"),
    constraint "contract_pipeline_settings_engine_check"
        check ("new_submission_engine" in ('legacy_text', 'docx'))
);

insert into "public"."contract_pipeline_settings" ("singleton", "new_submission_engine")
values (true, 'legacy_text');

alter table "public"."contract_submissions"
    add column "renderer_engine" text not null default 'legacy_text',
    add column "template_document_id" uuid,
    add column "form_data_encrypted" text;

alter table "public"."contract_submissions"
    add constraint "contract_submissions_renderer_engine_check"
        check ("renderer_engine" in ('legacy_text', 'docx')),
    add constraint "contract_submissions_template_document_fk"
        foreign key ("template_document_id", "template_id")
        references "public"."contract_template_documents"("id", "template_id")
        on delete restrict,
    add constraint "contract_submissions_encrypted_form_check"
        check ("form_data_encrypted" is null or "form_data_encrypted" like 'enc-bin-v1:%'),
    add constraint "contract_submissions_docx_provenance_check"
        check (
            ("renderer_engine" = 'legacy_text')
            or (
                "renderer_engine" = 'docx'
                and "template_document_id" is not null
                and "form_data" = '{}'::jsonb
                and "form_data_encrypted" like 'enc-bin-v1:%'
            )
        );

alter table "public"."contract_document_versions"
    add column "renderer_engine" text not null default 'legacy_text',
    add column "template_document_id" uuid references "public"."contract_template_documents"("id") on delete restrict,
    add column "parent_document_version_id" uuid references "public"."contract_document_versions"("id") on delete restrict,
    add column "form_data_snapshot_encrypted" text,
    add column "artifact_status" text,
    add column "docx_bucket" text,
    add column "docx_path" text,
    add column "docx_size_bytes" bigint,
    add column "docx_sha256" text,
    add column "pdf_bucket" text,
    add column "pdf_path" text,
    add column "pdf_size_bytes" bigint,
    add column "pdf_sha256" text,
    add column "page_count" integer,
    add column "signature_anchors" jsonb not null default '[]'::jsonb,
    add column "converter_version" text,
    add column "artifact_error_code" text,
    add column "artifact_error_message" text;

alter table "public"."contract_document_versions"
    add constraint "contract_document_versions_renderer_engine_check"
        check ("renderer_engine" in ('legacy_text', 'docx')),
    add constraint "contract_document_versions_artifact_status_check"
        check ("artifact_status" is null or "artifact_status" in ('queued', 'processing', 'ready', 'failed')),
    add constraint "contract_document_versions_encrypted_snapshot_check"
        check ("form_data_snapshot_encrypted" is null or "form_data_snapshot_encrypted" like 'enc-bin-v1:%'),
    add constraint "contract_document_versions_docx_tuple_check"
        check (
            ("docx_bucket" is null and "docx_path" is null and "docx_size_bytes" is null and "docx_sha256" is null)
            or (
                "docx_bucket" = 'contract-render-artifacts'
                and length(btrim("docx_path")) > 0
                and "docx_path" !~ '(^|/)\.\.(/|$)'
                and "docx_size_bytes" > 0
                and "docx_size_bytes" <= 52428800
                and "docx_sha256" ~ '^[0-9a-f]{64}$'
            )
        ),
    add constraint "contract_document_versions_pdf_tuple_check"
        check (
            ("pdf_bucket" is null and "pdf_path" is null and "pdf_size_bytes" is null and "pdf_sha256" is null)
            or (
                "pdf_bucket" = 'contract-render-artifacts'
                and length(btrim("pdf_path")) > 0
                and "pdf_path" !~ '(^|/)\.\.(/|$)'
                and "pdf_size_bytes" > 0
                and "pdf_size_bytes" <= 52428800
                and "pdf_sha256" ~ '^[0-9a-f]{64}$'
            )
        ),
    add constraint "contract_document_versions_artifact_state_check"
        check (
            (
                "renderer_engine" = 'legacy_text'
                and "artifact_status" is null
                and "template_document_id" is null
            )
            or (
                "renderer_engine" = 'docx'
                and "template_document_id" is not null
                and "form_data_snapshot" = '{}'::jsonb
                and "form_data_snapshot_encrypted" like 'enc-bin-v1:%'
                and (
                    ("artifact_status" in ('queued', 'processing') and "artifact_error_code" is null and "artifact_error_message" is null)
                    or (
                        "artifact_status" = 'ready'
                        and ("docx_path" is not null or "pdf_path" is not null)
                        and nullif(btrim("converter_version"), '') is not null
                        and "artifact_error_code" is null
                        and "artifact_error_message" is null
                    )
                    or (
                        "artifact_status" = 'failed'
                        and nullif(btrim("artifact_error_code"), '') is not null
                        and nullif(btrim("artifact_error_message"), '') is not null
                    )
                )
            )
        ),
    add constraint "contract_document_versions_page_count_check"
        check ("page_count" is null or "page_count" > 0),
    add constraint "contract_document_versions_signature_anchors_check"
        check (jsonb_typeof("signature_anchors") = 'array'),
    add constraint "contract_document_versions_not_own_parent_check"
        check ("parent_document_version_id" is null or "parent_document_version_id" <> "id"),
    add constraint "contract_document_versions_id_submission_unique"
        unique ("id", "submission_id");

create unique index "contract_document_versions_docx_object_idx"
    on "public"."contract_document_versions" ("docx_bucket", "docx_path")
    where "docx_path" is not null;

create unique index "contract_document_versions_pdf_object_idx"
    on "public"."contract_document_versions" ("pdf_bucket", "pdf_path")
    where "pdf_path" is not null;

create table "public"."contract_render_jobs" (
    "id" uuid primary key default gen_random_uuid(),
    "operation" text not null,
    "status" text not null default 'queued',
    "template_document_id" uuid references "public"."contract_template_documents"("id") on delete restrict,
    "submission_id" uuid references "public"."contract_submissions"("id") on delete restrict,
    "document_version_id" uuid,
    "encrypted_payload" text not null,
    "idempotency_key" text not null unique,
    "attempt_count" integer not null default 0,
    "max_attempts" integer not null default 5,
    "run_after" timestamptz not null default now(),
    "leased_by" text,
    "lease_token" uuid,
    "lease_expires_at" timestamptz,
    "last_error_code" text,
    "last_error_message" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    "finished_at" timestamptz,
    constraint "contract_render_jobs_operation_check"
        check ("operation" in ('template_preview', 'submission_render', 'partner_signature', 'board_signature', 'opensign_ingest')),
    constraint "contract_render_jobs_status_check"
        check ("status" in ('queued', 'processing', 'succeeded', 'failed')),
    constraint "contract_render_jobs_encrypted_payload_check"
        check ("encrypted_payload" like 'enc-bin-v1:%'),
    constraint "contract_render_jobs_attempts_check"
        check ("attempt_count" >= 0 and "max_attempts" > 0 and "attempt_count" <= "max_attempts"),
    constraint "contract_render_jobs_target_check"
        check (
            ("operation" = 'template_preview' and "template_document_id" is not null)
            or ("operation" <> 'template_preview' and "submission_id" is not null and "document_version_id" is not null)
        ),
    constraint "contract_render_jobs_lease_check"
        check (
            ("status" = 'queued' and "leased_by" is null and "lease_token" is null and "lease_expires_at" is null and "finished_at" is null)
            or ("status" = 'processing' and nullif(btrim("leased_by"), '') is not null and "lease_token" is not null and "lease_expires_at" is not null and "finished_at" is null)
            or ("status" in ('succeeded', 'failed') and "lease_token" is not null and "finished_at" is not null)
        ),
    constraint "contract_render_jobs_document_version_fk"
        foreign key ("document_version_id", "submission_id")
        references "public"."contract_document_versions"("id", "submission_id")
        on delete restrict
);

create index "contract_render_jobs_claim_idx"
    on "public"."contract_render_jobs" ("run_after", "created_at")
    where "status" in ('queued', 'processing');

create index "contract_render_jobs_submission_idx"
    on "public"."contract_render_jobs" ("submission_id", "created_at" desc);

create or replace function "public"."protect_contract_template_document_source"()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.template_id is distinct from old.template_id
        or new.version is distinct from old.version
        or new.source_bucket is distinct from old.source_bucket
        or new.source_path is distinct from old.source_path
        or new.source_size_bytes is distinct from old.source_size_bytes
        or new.source_sha256 is distinct from old.source_sha256
        or new.original_filename is distinct from old.original_filename
        or (old.status = 'ready' and (
            new.status is distinct from old.status
            or new.preview_bucket is distinct from old.preview_bucket
            or new.preview_path is distinct from old.preview_path
            or new.preview_size_bytes is distinct from old.preview_size_bytes
            or new.preview_sha256 is distinct from old.preview_sha256
            or new.placeholder_manifest is distinct from old.placeholder_manifest
            or new.validation_issues is distinct from old.validation_issues
            or new.signature_anchors is distinct from old.signature_anchors
            or new.converter_version is distinct from old.converter_version
        ))
    then
        raise exception 'contract template source provenance is immutable' using errcode = '55000';
    end if;
    return new;
end;
$$;

create trigger "protect_contract_template_document_source_trigger"
before update on "public"."contract_template_documents"
for each row execute function "public"."protect_contract_template_document_source"();

create or replace function "public"."protect_ready_contract_artifact"()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if old.artifact_status = 'ready' and (
        new.renderer_engine is distinct from old.renderer_engine
        or new.template_document_id is distinct from old.template_document_id
        or new.parent_document_version_id is distinct from old.parent_document_version_id
        or new.docx_bucket is distinct from old.docx_bucket
        or new.docx_path is distinct from old.docx_path
        or new.docx_size_bytes is distinct from old.docx_size_bytes
        or new.docx_sha256 is distinct from old.docx_sha256
        or new.pdf_bucket is distinct from old.pdf_bucket
        or new.pdf_path is distinct from old.pdf_path
        or new.pdf_size_bytes is distinct from old.pdf_size_bytes
        or new.pdf_sha256 is distinct from old.pdf_sha256
        or new.page_count is distinct from old.page_count
        or new.signature_anchors is distinct from old.signature_anchors
        or new.converter_version is distinct from old.converter_version
        or new.artifact_status is distinct from old.artifact_status
    ) then
        raise exception 'ready contract artifact provenance is immutable' using errcode = '55000';
    end if;
    return new;
end;
$$;

create trigger "protect_ready_contract_artifact_trigger"
before update on "public"."contract_document_versions"
for each row execute function "public"."protect_ready_contract_artifact"();

-- Existing rows explicitly remain on the legacy renderer. No legacy submission
-- is reinterpreted through DOCX during this additive rollout.
update "public"."contract_templates" set "renderer_engine" = 'legacy_text' where "renderer_engine" is distinct from 'legacy_text';
update "public"."contract_submissions" set "renderer_engine" = 'legacy_text' where "renderer_engine" is distinct from 'legacy_text';
update "public"."contract_document_versions" set "renderer_engine" = 'legacy_text' where "renderer_engine" is distinct from 'legacy_text';

create or replace function "public"."create_contract_template_document_version"(
    p_template_id uuid,
    p_source_path text,
    p_source_size_bytes bigint,
    p_source_sha256 text,
    p_original_filename text,
    p_placeholder_manifest jsonb default '{}'::jsonb,
    p_signature_anchors jsonb default '[]'::jsonb,
    p_uploaded_by_user_id uuid default null,
    p_id uuid default gen_random_uuid()
)
returns "public"."contract_template_documents"
language plpgsql
security definer
set search_path = public
as $$
declare
    v_version integer;
    v_row public.contract_template_documents;
begin
    perform pg_advisory_xact_lock(hashtextextended(p_template_id::text, 0));
    perform 1 from public.contract_templates where id = p_template_id for update;
    if not found then
        raise exception 'contract template not found' using errcode = 'P0002';
    end if;

    select coalesce(max(version), 0) + 1 into v_version
    from public.contract_template_documents
    where template_id = p_template_id;

    insert into public.contract_template_documents (
        id, template_id, version, source_path, source_size_bytes, source_sha256,
        original_filename, placeholder_manifest, signature_anchors,
        uploaded_by_user_id
    ) values (
        p_id, p_template_id, v_version, p_source_path, p_source_size_bytes,
        lower(p_source_sha256), p_original_filename,
        coalesce(p_placeholder_manifest, '{}'::jsonb),
        coalesce(p_signature_anchors, '[]'::jsonb), p_uploaded_by_user_id
    )
    returning * into v_row;
    return v_row;
end;
$$;

create or replace function "public"."activate_contract_template_document"(
    p_template_id uuid,
    p_document_id uuid
)
returns "public"."contract_template_documents"
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row public.contract_template_documents;
begin
    perform pg_advisory_xact_lock(hashtextextended(p_template_id::text, 0));
    perform 1 from public.contract_templates where id = p_template_id for update;
    if not found then
        raise exception 'contract template not found' using errcode = 'P0002';
    end if;

    select * into v_row
    from public.contract_template_documents
    where id = p_document_id and template_id = p_template_id
    for update;
    if not found then
        raise exception 'contract template document not found' using errcode = 'P0002';
    end if;
    if v_row.status <> 'ready' then
        raise exception 'contract template document is not ready' using errcode = '23514';
    end if;

    update public.contract_template_documents
    set activated_at = coalesce(activated_at, now()), updated_at = now()
    where id = p_document_id
    returning * into v_row;

    update public.contract_templates
    set active_document_id = p_document_id, renderer_engine = 'docx', updated_at = now()
    where id = p_template_id;
    return v_row;
end;
$$;

create or replace function "public"."insert_contract_document_version"(
    p_submission_id uuid,
    p_source text,
    p_rendered_text text default '',
    p_rendered_html text default '',
    p_form_data_snapshot_encrypted text default null,
    p_created_by uuid default null,
    p_parent_document_version_id uuid default null,
    p_reset_for_legal_review boolean default false,
    p_id uuid default gen_random_uuid()
)
returns "public"."contract_document_versions"
language plpgsql
security definer
set search_path = public
as $$
declare
    v_submission public.contract_submissions;
    v_version integer;
    v_row public.contract_document_versions;
begin
    perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));
    select * into v_submission
    from public.contract_submissions
    where id = p_submission_id
    for update;
    if not found then
        raise exception 'contract submission not found' using errcode = 'P0002';
    end if;
    if p_reset_for_legal_review and v_submission.renderer_engine <> 'docx' then
        raise exception 'legal DOCX reset requires a DOCX submission' using errcode = '23514';
    end if;

    select coalesce(max(version_number), 0) + 1 into v_version
    from public.contract_document_versions
    where submission_id = p_submission_id;

    insert into public.contract_document_versions (
        id, submission_id, version_number, source, rendered_text, rendered_html,
        form_data_snapshot, form_data_snapshot_encrypted, created_by,
        renderer_engine, template_document_id, parent_document_version_id,
        artifact_status
    ) values (
        p_id, p_submission_id, v_version, p_source,
        case when v_submission.renderer_engine = 'docx' then '' else coalesce(p_rendered_text, '') end,
        case when v_submission.renderer_engine = 'docx' then '' else coalesce(p_rendered_html, '') end,
        '{}'::jsonb, p_form_data_snapshot_encrypted, p_created_by,
        v_submission.renderer_engine, v_submission.template_document_id,
        p_parent_document_version_id,
        case when v_submission.renderer_engine = 'docx' then 'queued' else null end
    ) returning * into v_row;

    update public.contract_submissions
    set active_document_version_id = v_row.id,
        status = case when p_reset_for_legal_review then 'legal_review' else status end,
        sent_document_version_id = case when p_reset_for_legal_review then null else sent_document_version_id end,
        final_document_version_id = case when p_reset_for_legal_review then null else final_document_version_id end,
        signature_token = case when p_reset_for_legal_review then null else signature_token end,
        signature_token_expires_at = case when p_reset_for_legal_review then null else signature_token_expires_at end,
        board_signature_token = case when p_reset_for_legal_review then null else board_signature_token end,
        board_signature_token_expires_at = case when p_reset_for_legal_review then null else board_signature_token_expires_at end,
        signature_data = case when p_reset_for_legal_review then null else signature_data end,
        signer_name = case when p_reset_for_legal_review then null else signer_name end,
        signed_at = case when p_reset_for_legal_review then null else signed_at end,
        admin_signature_data = case when p_reset_for_legal_review then null else admin_signature_data end,
        admin_signer_name = case when p_reset_for_legal_review then null else admin_signer_name end,
        admin_signed_at = case when p_reset_for_legal_review then null else admin_signed_at end,
        final_pdf_token = case when p_reset_for_legal_review then null else final_pdf_token end,
        final_pdf_sent_at = case when p_reset_for_legal_review then null else final_pdf_sent_at end,
        completed_at = case when p_reset_for_legal_review then null else completed_at end,
        sent_to_partner_at = case when p_reset_for_legal_review then null else sent_to_partner_at end,
        opensign_document_id = case when p_reset_for_legal_review then null else opensign_document_id end,
        opensign_status = case when p_reset_for_legal_review then null else opensign_status end,
        opensign_sent_at = case when p_reset_for_legal_review then null else opensign_sent_at end,
        opensign_completed_at = case when p_reset_for_legal_review then null else opensign_completed_at end,
        opensign_file_url = case when p_reset_for_legal_review then null else opensign_file_url end,
        opensign_certificate_url = case when p_reset_for_legal_review then null else opensign_certificate_url end,
        opensign_error = case when p_reset_for_legal_review then null else opensign_error end,
        opensign_webhook_last_event = case when p_reset_for_legal_review then null else opensign_webhook_last_event end,
        opensign_webhook_received_at = case when p_reset_for_legal_review then null else opensign_webhook_received_at end,
        updated_at = now()
    where id = p_submission_id;
    return v_row;
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
    p_error_message text default null
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
        if v_job.attempt_count < v_job.max_attempts then
            if v_job.operation = 'template_preview' then
                update public.contract_template_documents
                set status = 'queued', error_code = null, error_message = null,
                    updated_at = now()
                where id = v_job.template_document_id;
            else
                update public.contract_document_versions
                set artifact_status = 'queued', artifact_error_code = null,
                    artifact_error_message = null
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

alter table "public"."contract_template_documents" enable row level security;
alter table "public"."contract_pipeline_settings" enable row level security;
alter table "public"."contract_render_jobs" enable row level security;

revoke all on table "public"."contract_template_documents" from "public", "anon", "authenticated";
revoke all on table "public"."contract_pipeline_settings" from "public", "anon", "authenticated";
revoke all on table "public"."contract_render_jobs" from "public", "anon", "authenticated";
grant all on table "public"."contract_template_documents" to "service_role";
grant all on table "public"."contract_pipeline_settings" to "service_role";
grant all on table "public"."contract_render_jobs" to "service_role";

revoke all on function "public"."create_contract_template_document_version"(uuid, text, bigint, text, text, jsonb, jsonb, uuid, uuid) from "public", "anon", "authenticated";
revoke all on function "public"."activate_contract_template_document"(uuid, uuid) from "public", "anon", "authenticated";
revoke all on function "public"."insert_contract_document_version"(uuid, text, text, text, text, uuid, uuid, boolean, uuid) from "public", "anon", "authenticated";
revoke all on function "public"."claim_contract_render_job"(text, integer) from "public", "anon", "authenticated";
revoke all on function "public"."finalize_contract_render_job"(uuid, uuid, boolean, text, text, bigint, text, text, bigint, text, integer, jsonb, text, bigint, text, jsonb, text, text) from "public", "anon", "authenticated";
revoke all on function "public"."protect_contract_template_document_source"() from "public", "anon", "authenticated";
revoke all on function "public"."protect_ready_contract_artifact"() from "public", "anon", "authenticated";

grant execute on function "public"."create_contract_template_document_version"(uuid, text, bigint, text, text, jsonb, jsonb, uuid, uuid) to "service_role";
grant execute on function "public"."activate_contract_template_document"(uuid, uuid) to "service_role";
grant execute on function "public"."insert_contract_document_version"(uuid, text, text, text, text, uuid, uuid, boolean, uuid) to "service_role";
grant execute on function "public"."claim_contract_render_job"(text, integer) to "service_role";
grant execute on function "public"."finalize_contract_render_job"(uuid, uuid, boolean, text, text, bigint, text, text, bigint, text, integer, jsonb, text, bigint, text, jsonb, text, text) to "service_role";

comment on table "public"."contract_template_documents" is
    'Immutable encrypted DOCX template sources and their validated previews.';
comment on table "public"."contract_render_jobs" is
    'Durable service-role-only jobs. Payloads are application encrypted enc-bin-v1 ciphertext.';
comment on column "public"."contract_pipeline_settings"."new_submission_engine" is
    'Global cutover for new submissions only. Existing submissions retain their pinned renderer.';

-- Fail the migration itself if the safe rollout defaults or bucket privacy are
-- accidentally weakened by a later edit before this migration is merged.
do $$
begin
    if not exists (
        select 1 from public.contract_pipeline_settings
        where singleton and new_submission_engine = 'legacy_text'
    ) then
        raise exception 'DOCX pipeline must deploy with the legacy cutover default';
    end if;
    if exists (
        select 1 from storage.buckets
        where id in ('contract-template-documents', 'contract-render-artifacts')
          and public
    ) then
        raise exception 'contract storage buckets must remain private';
    end if;
    if exists (
        select 1 from public.contract_submissions
        where renderer_engine <> 'legacy_text'
    ) then
        raise exception 'legacy submissions must not change renderer during migration';
    end if;
end;
$$;

commit;
