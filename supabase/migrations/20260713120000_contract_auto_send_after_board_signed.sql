begin;

-- Opt-in auto-send: when enabled, a board signature automatically finalizes
-- the contract and emails the partner the final PDF link instead of waiting
-- for the manual "Generate final PDF link" flow.
alter table "public"."contract_submissions"
    add column if not exists "auto_send_after_board_signed" boolean not null default false;

-- Allow the EMAIL variable type (validated server-side as an email address).
alter table "public"."contract_template_variables"
    drop constraint if exists "contract_template_variables_data_type_check";
alter table "public"."contract_template_variables"
    add constraint "contract_template_variables_data_type_check"
        check ("data_type" in ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'FILE', 'EMAIL'));

commit;
