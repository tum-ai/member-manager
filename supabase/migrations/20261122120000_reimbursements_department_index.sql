-- Index for the department request list (#367).
--
-- `GET /api/reimbursements/department` filters by department and pages through
-- the result newest first, with `id` as the tie-breaker. Until now the table
-- only had an index on (user_id, created_at), so this query scanned every row.

create index if not exists "reimbursements_department_created_at_idx"
    on "public"."reimbursements" ("department", "created_at" desc, "id" desc);
