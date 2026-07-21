-- Member merge audit rows predate encrypted-only storage and may contain
-- plaintext profile or bank fields. Keep audit metadata while removing fields
-- that must never be retained in plaintext or returned from the database.

create or replace function "private"."sanitize_member_merge_snapshot"(
    "snapshot" jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
    select jsonb_set(
        jsonb_set(
            "snapshot",
            '{member}',
            coalesce("snapshot" -> 'member', '{}'::jsonb)
                - array[
                    'date_of_birth',
                    'street',
                    'number',
                    'postal_code',
                    'city',
                    'country',
                    'phone'
                ]::text[],
            true
        ),
        '{sepa}',
        coalesce(
            (
                select jsonb_agg(
                    "sepa_entry"
                        - array['iban', 'bic', 'bank_name']::text[]
                )
                from jsonb_array_elements(
                    coalesce("snapshot" -> 'sepa', '[]'::jsonb)
                ) as "entries"("sepa_entry")
            ),
            '[]'::jsonb
        ),
        true
    );
$$;

update "public"."member_merge_audit"
set "source_snapshot" =
    "private"."sanitize_member_merge_snapshot"("source_snapshot");

create or replace function "private"."sanitize_member_merge_audit_snapshot"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.source_snapshot :=
        private.sanitize_member_merge_snapshot(new.source_snapshot);
    return new;
end;
$$;

drop trigger if exists "sanitize_member_merge_audit_snapshot"
on "public"."member_merge_audit";

create trigger "sanitize_member_merge_audit_snapshot"
before insert or update of "source_snapshot"
on "public"."member_merge_audit"
for each row
execute function "private"."sanitize_member_merge_audit_snapshot"();

revoke all
on function "private"."sanitize_member_merge_snapshot"(jsonb)
from public, anon, authenticated;

revoke all
on function "private"."sanitize_member_merge_audit_snapshot"()
from public, anon, authenticated;
