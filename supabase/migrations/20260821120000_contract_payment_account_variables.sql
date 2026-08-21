-- The Hackathon and AI E-Lab source documents contain the TUM.ai payment
-- account placeholder. Make that value part of both template forms so the DOCX
-- workflow can validate and fill the uploaded documents.

insert into public.contract_template_variables (
    template_id,
    variable_name,
    label,
    data_type,
    help_text,
    is_required,
    is_multiselect,
    sort_order
)
values
    (
        '10000000-0000-4000-8000-000000000002',
        'payment_account',
        'Payment account',
        'TEXTAREA',
        'TUM.ai payment account details used in the contract.',
        true,
        false,
        120
    ),
    (
        '10000000-0000-4000-8000-000000000003',
        'payment_account',
        'Payment account',
        'TEXTAREA',
        'TUM.ai payment account details used in the contract.',
        true,
        false,
        110
    )
on conflict (template_id, variable_name) do update
set
    label = excluded.label,
    data_type = excluded.data_type,
    help_text = excluded.help_text,
    is_required = excluded.is_required,
    is_multiselect = excluded.is_multiselect,
    sort_order = excluded.sort_order,
    updated_at = now();
