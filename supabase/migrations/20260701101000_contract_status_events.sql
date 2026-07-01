begin;

-- Append-only audit of contract status transitions so the full history stays
-- visible in the contract view (the submission row only holds the current
-- status). Mirrors the append pattern of contract_document_versions.
create table if not exists "public"."contract_status_events" (
    "id" uuid primary key default gen_random_uuid(),
    "submission_id" uuid not null references "public"."contract_submissions"("id") on delete cascade,
    "from_status" text,
    "to_status" text not null,
    "changed_by" uuid references "auth"."users"("id") on delete set null,
    "changed_by_name" text,
    "note" text,
    "created_at" timestamptz not null default now()
);

create index if not exists "contract_status_events_submission_created_idx"
    on "public"."contract_status_events" ("submission_id", "created_at" asc);

alter table "public"."contract_status_events" enable row level security;

drop policy if exists "Contracts admins read status events" on "public"."contract_status_events";
create policy "Contracts admins read status events"
    on "public"."contract_status_events"
    as permissive
    for select
    to authenticated
    using (
        exists (
            select 1 from "public"."user_roles" ur
            where ur.user_id = auth.uid() and ur.role = 'admin'
        )
        or exists (
            select 1 from "public"."members" m
            join "public"."department_permissions" dp on dp.department = m.department
            where m.user_id = auth.uid()
              and coalesce(m.member_status, case when m.active then 'active' else 'inactive' end) = 'active'
              and dp.permissions ? 'contracts.admin'
        )
        or exists (
            select 1 from "public"."contract_submissions" cs
            where cs."id" = "contract_status_events"."submission_id"
              and cs."submitter_user_id" = auth.uid()
        )
    );

grant select on table "public"."contract_status_events" to "authenticated";
grant all on table "public"."contract_status_events" to "service_role";

-- Backfill one "current status" event per existing submission so the timeline
-- is not empty for contracts created before this table existed.
insert into "public"."contract_status_events" (
    "submission_id",
    "from_status",
    "to_status",
    "note",
    "created_at"
)
select
    cs."id",
    null,
    cs."status",
    'Backfilled from current status',
    coalesce(cs."updated_at", cs."submitted_at", now())
from "public"."contract_submissions" cs
where not exists (
    select 1 from "public"."contract_status_events" cse
    where cse."submission_id" = cs."id"
);

commit;
