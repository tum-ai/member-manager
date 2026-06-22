alter table "public"."members"
add column if not exists "reimbursement_slack_notifications_enabled" boolean not null default false;
