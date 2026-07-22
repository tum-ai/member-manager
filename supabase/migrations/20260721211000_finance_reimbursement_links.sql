begin;

alter table "public"."reimbursements"
    add column "finance_project_id" uuid
        references "public"."finance_projects"("id") on delete set null,
    add column "finance_plan_item_id" uuid
        references "public"."finance_plan_items"("id") on delete set null,
    add column "bb_posting_external_id" text,
    add constraint "reimbursements_bb_posting_external_id_check"
        check (
            "bb_posting_external_id" is null
            or length(btrim("bb_posting_external_id")) between 1 and 200
        );

create index "reimbursements_finance_project_idx"
on "public"."reimbursements" ("finance_project_id")
where "finance_project_id" is not null;

create index "reimbursements_finance_plan_item_idx"
on "public"."reimbursements" ("finance_plan_item_id")
where "finance_plan_item_id" is not null;

create index "reimbursements_bb_posting_external_id_idx"
on "public"."reimbursements" ("bb_posting_external_id")
where "bb_posting_external_id" is not null;

-- Reimbursements remain server-only because they contain encrypted bank data.
revoke all on table "public"."reimbursements"
from public, anon, authenticated, service_role;
grant select, insert, update, delete
on table "public"."reimbursements"
to service_role;

commit;
