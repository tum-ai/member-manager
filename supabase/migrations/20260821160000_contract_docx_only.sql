begin;

-- New contracts use DOCX only. Historical text rows stay readable so this
-- migration does not rewrite or destroy signed contract history.
alter table public.contract_templates
    alter column renderer_engine set default 'docx';

alter table public.contract_pipeline_settings
    alter column new_submission_engine set default 'docx';

update public.contract_pipeline_settings
set new_submission_engine = 'docx',
    updated_at = now()
where singleton = true;

-- A text template cannot be submitted after the cutover. Legal must upload
-- and activate a ready DOCX version before the template becomes visible.
update public.contract_templates
set is_active = false,
    renderer_engine = case
        when active_document_id is not null then 'docx'
        else renderer_engine
    end,
    updated_at = now()
where active_document_id is null or renderer_engine <> 'docx';

commit;
