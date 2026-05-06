begin;

create table if not exists "public"."reimbursements" (
    "id" uuid primary key default gen_random_uuid(),
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "amount" numeric(12, 2) not null,
    "date" date not null,
    "description" text not null,
    "department" text not null,
    "submission_type" text not null default 'reimbursement',
    "payment_iban" text,
    "payment_bic" text,
    "receipt_filename" text not null,
    "receipt_mime_type" text not null,
    "receipt_base64" text not null,
    "status" text not null default 'requested',
    "approval_status" text not null default 'pending',
    "payment_status" text not null default 'to_be_paid',
    "rejection_reason" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now(),
    constraint "reimbursements_amount_check" check ("amount" > 0),
    constraint "reimbursements_submission_type_check"
        check ("submission_type" in ('reimbursement', 'invoice')),
    constraint "reimbursements_status_check"
        check ("status" in ('requested', 'rejected', 'paid')),
    constraint "reimbursements_approval_status_check"
        check ("approval_status" in ('pending', 'approved', 'not_approved')),
    constraint "reimbursements_payment_status_check"
        check ("payment_status" in ('to_be_paid', 'paid')),
    constraint "reimbursements_bank_details_required_check"
        check ("payment_iban" is not null and "payment_bic" is not null)
);

create index if not exists "reimbursements_user_id_created_at_idx"
    on "public"."reimbursements" ("user_id", "created_at" desc);

alter table "public"."reimbursements" enable row level security;

drop policy if exists "Admins manage reimbursements" on "public"."reimbursements";
create policy "Admins manage reimbursements"
    on "public"."reimbursements"
    as permissive
    for all
    to authenticated
    using (
        exists (
            select 1
            from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    )
    with check (
        exists (
            select 1
            from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
    );

drop policy if exists "Members insert own reimbursements" on "public"."reimbursements";
create policy "Members insert own reimbursements"
    on "public"."reimbursements"
    as permissive
    for insert
    to authenticated
    with check ("user_id" = auth.uid());

drop policy if exists "Members read own reimbursements" on "public"."reimbursements";
create policy "Members read own reimbursements"
    on "public"."reimbursements"
    as permissive
    for select
    to authenticated
    using ("user_id" = auth.uid());

revoke all on table "public"."reimbursements" from "anon";
grant select, insert on table "public"."reimbursements" to "authenticated";
grant all on table "public"."reimbursements" to "service_role";

commit;
