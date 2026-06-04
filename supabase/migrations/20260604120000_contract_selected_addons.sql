begin;

insert into "public"."contract_template_variables"
    (
        "id",
        "template_id",
        "variable_name",
        "label",
        "data_type",
        "help_text",
        "options",
        "is_required",
        "is_multiselect",
        "sort_order"
    )
values
(
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    'selected_addons',
    'A-la-carte add-ons',
    'SELECT',
    'Optional services added to the contract appendix.',
    '["long_term_extra_linkedin_post","long_term_custom_mail","long_term_workshop_slot","long_term_hackathon_challenge"]'::jsonb,
    false,
    true,
    55
),
(
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000002',
    'selected_addons',
    'A-la-carte add-ons',
    'SELECT',
    'Optional services added to the contract appendix.',
    '["ehl_catering_sponsorship","ehl_ceremony_job_posting","ehl_workshop_slot"]'::jsonb,
    false,
    true,
    90
)
on conflict ("template_id", "variable_name") do update
set
    "label" = excluded."label",
    "data_type" = excluded."data_type",
    "help_text" = excluded."help_text",
    "options" = excluded."options",
    "is_required" = excluded."is_required",
    "is_multiselect" = excluded."is_multiselect",
    "sort_order" = excluded."sort_order",
    "updated_at" = now();

delete from "public"."contract_template_variables"
where "template_id" = '10000000-0000-4000-8000-000000000002'
  and "variable_name" = 'addon_terms';

update "public"."contract_template_variables"
set
    "label" = 'Additional special terms',
    "updated_at" = now()
where "template_id" = '10000000-0000-4000-8000-000000000001'
  and "variable_name" = 'custom_terms';

update "public"."contract_templates"
set
    "contract_text" = replace(
        "contract_text",
        'Das Partnerunternehmen zahlt an TUM.ai nach entsprechender Rechnungstellung durch TUM.ai jährlich jeweils bis zum {{payment_due_date}} einen Betrag in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzüglich gesetzlich geschuldeter Umsatzsteuer.

{{custom_terms}}',
        'Das Partnerunternehmen zahlt an TUM.ai nach entsprechender Rechnungstellung durch TUM.ai jährlich jeweils bis zum {{payment_due_date}} einen Betrag in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzüglich gesetzlich geschuldeter Umsatzsteuer.

Zusätzlich ausgewählte Add-ons:
{{addon_terms}}

{{custom_terms}}'
    ),
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000001'
  and "contract_text" not like '%{{addon_terms}}%';

update "public"."contract_templates"
set
    "contract_text" = replace(
        "contract_text",
        'Add-ons / besondere Vereinbarungen:
{{custom_terms}}',
        'Zusaetzlich ausgewaehlte Add-ons:
{{addon_terms}}

Besondere Vereinbarungen:
{{custom_terms}}'
    ),
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000001'
  and "contract_text" not like '%{{addon_terms}}%';

commit;
