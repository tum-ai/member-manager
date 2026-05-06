begin;

alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_reimbursement_bank_check";

alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_bank_details_required_check";

alter table "public"."reimbursements"
    add constraint "reimbursements_bank_details_required_check"
    check ("payment_iban" is not null and "payment_bic" is not null)
    not valid;

commit;
