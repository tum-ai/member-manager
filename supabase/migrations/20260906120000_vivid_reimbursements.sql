begin;

-- Vivid expenses use the existing reimbursement workflow and receipt storage,
-- but they are tracked as expenses without a payout account or payout step.
alter table "public"."reimbursements"
    drop constraint if exists "reimbursements_submission_type_check",
    drop constraint if exists "reimbursements_payment_status_check",
    drop constraint if exists "reimbursements_bank_details_required_check",
    drop constraint if exists "reimbursements_vivid_payment_status_check",
    drop constraint if exists "reimbursements_vivid_status_check";

alter table "public"."reimbursements"
    add constraint "reimbursements_submission_type_check"
        check ("submission_type" in ('reimbursement', 'invoice', 'vivid_reimbursement')),
    add constraint "reimbursements_payment_status_check"
        check ("payment_status" in ('to_be_paid', 'paid', 'not_required')),
    -- Keep this constraint unvalidated because historical rows may contain
    -- legacy nullable/partially populated bank fields from before encrypted
    -- bank-detail enforcement. PostgreSQL still applies it to new writes.
    add constraint "reimbursements_bank_details_required_check"
        check (
            (
                "submission_type" = 'vivid_reimbursement'
                and "payment_iban" is null
                and "payment_bic" is null
            )
            or (
                "submission_type" in ('reimbursement', 'invoice')
                and "payment_iban" is not null
                and "payment_bic" is not null
            )
        )
        not valid,
    add constraint "reimbursements_vivid_payment_status_check"
        check (
            (
                "submission_type" = 'vivid_reimbursement'
                and "payment_status" = 'not_required'
            )
            or (
                "submission_type" in ('reimbursement', 'invoice')
                and "payment_status" in ('to_be_paid', 'paid')
            )
        ),
    add constraint "reimbursements_vivid_status_check"
        check (
            "submission_type" <> 'vivid_reimbursement'
            or "status" <> 'paid'
        );

alter table "public"."reimbursements" enable row level security;

-- The table is intentionally API-only because it contains encrypted payout
-- data. Keep this policy restrictive as defense in depth if a future grant is
-- ever introduced: only an authenticated eligible Vivid submitter can insert
-- a Vivid row, while all browser writes remain denied by the table grant.
drop policy if exists "Eligible Vivid members insert reimbursements"
    on "public"."reimbursements";
create policy "Eligible Vivid members insert reimbursements"
    on "public"."reimbursements"
    as restrictive
    for insert
    to authenticated
    with check (
        "submission_type" = 'vivid_reimbursement'
        and "user_id" = auth.uid()
        and (
            exists (
                select 1
                from "public"."user_roles" ur
                where ur.user_id = auth.uid()
                  and ur.role = 'admin'
            )
            or exists (
                select 1
                from "public"."members" m
                where m.user_id = auth.uid()
                  and coalesce(
                      m.member_status,
                      case when m.active then 'active' else 'inactive' end
                  ) = 'active'
                  and m.member_role in ('Team Lead', 'President', 'Vice-President')
            )
        )
    );

-- Re-assert the API-only boundary after all prior reimbursement policies and
-- grants have been inspected. The service role is the sole database writer.
revoke all on table "public"."reimbursements"
    from public, anon, authenticated;
grant select, insert, update, delete
    on table "public"."reimbursements"
    to service_role;

commit;
