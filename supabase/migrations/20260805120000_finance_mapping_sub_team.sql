-- Sub-team (2nd meaningful digit of the BB Kostenstelle, e.g. Big/Small
-- Makeathon) is currently collapsed into the department when a cost location is
-- mapped. Give it a home so the LnF can label it in the Zuordnung and the
-- T-Konto can group department-direct postings per sub-team/project.
--
-- Idempotent so it is safe alongside a manual local hotfix.
alter table "public"."finance_department_mappings"
    add column if not exists "sub_team" text;
