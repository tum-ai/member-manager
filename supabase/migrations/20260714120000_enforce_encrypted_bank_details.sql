-- Sensitive profile and bank details are encrypted by the server before
-- persistence. Enforcement triggers protect new writes without breaking
-- unrelated updates to legacy rows that still need the application backfill.

create or replace function "public"."handle_new_user"() returns "trigger"
    language "plpgsql" security definer
    set search_path = ''
    as $$
begin
    insert into public.members (
        user_id,
        given_name,
        surname,
        date_of_birth,
        street,
        number,
        postal_code,
        city,
        country
    )
    values (new.id, '', '', '', '', '', '', '', '');

    insert into public.user_roles (user_id, role)
    values (new.id, 'user');

    return new;
end;
$$;

create schema if not exists "private";
revoke all on schema "private" from "public", "anon", "authenticated";

create or replace function "private"."is_encrypted_sensitive_value"("value" text)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select
        "value" is null
        or "value" = ''
        or "value" ~ '^enc-v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$';
$$;

create or replace function "private"."enforce_encrypted_sensitive_fields"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_table_name = 'members' then
        if not (
            private.is_encrypted_sensitive_value(new.date_of_birth)
            and private.is_encrypted_sensitive_value(new.street)
            and private.is_encrypted_sensitive_value(new.number)
            and private.is_encrypted_sensitive_value(new.postal_code)
            and private.is_encrypted_sensitive_value(new.city)
            and private.is_encrypted_sensitive_value(new.country)
            and private.is_encrypted_sensitive_value(new.phone)
        ) then
            raise check_violation using message = 'Sensitive member fields must be encrypted';
        end if;
    elsif tg_table_name = 'sepa' then
        if not (
            private.is_encrypted_sensitive_value(new.iban)
            and private.is_encrypted_sensitive_value(new.bic)
            and private.is_encrypted_sensitive_value(new.bank_name)
        ) then
            raise check_violation using message = 'Sensitive SEPA fields must be encrypted';
        end if;
    elsif tg_table_name = 'reimbursements' then
        if not (
            private.is_encrypted_sensitive_value(new.payment_iban)
            and private.is_encrypted_sensitive_value(new.payment_bic)
        ) then
            raise check_violation using message = 'Sensitive reimbursement fields must be encrypted';
        end if;
    end if;

    return new;
end;
$$;

create trigger "enforce_members_sensitive_insert"
before insert on "public"."members"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

create trigger "enforce_members_sensitive_update"
before update of
    "date_of_birth", "street", "number", "postal_code", "city", "country", "phone"
on "public"."members"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

create trigger "enforce_sepa_sensitive_insert"
before insert on "public"."sepa"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

create trigger "enforce_sepa_sensitive_update"
before update of "iban", "bic", "bank_name" on "public"."sepa"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

create trigger "enforce_reimbursements_sensitive_insert"
before insert on "public"."reimbursements"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

create trigger "enforce_reimbursements_sensitive_update"
before update of "payment_iban", "payment_bic" on "public"."reimbursements"
for each row execute function "private"."enforce_encrypted_sensitive_fields"();

-- Browser writes use the Fastify API. Direct member reads retain only the
-- non-sensitive columns needed by existing member-directory and RLS behavior.
revoke insert, update, delete, truncate, references, trigger
    on table "public"."members" from "anon", "authenticated";
revoke select on table "public"."members" from "anon", "authenticated";
grant select (
    "created_at",
    "surname",
    "user_id",
    "given_name",
    "title",
    "active",
    "salutation",
    "batch",
    "department",
    "member_role",
    "degree",
    "school",
    "member_status",
    "board_role",
    "linkedin_profile_url",
    "public_location",
    "research_project_id",
    "reimbursement_slack_notifications_enabled"
) on table "public"."members" to "authenticated";
revoke all on table "public"."sepa" from "anon", "authenticated";
revoke all on table "public"."reimbursements" from "anon", "authenticated";

drop policy if exists "Allow insert for authenticated users" on "public"."members";
drop policy if exists "Users can insert their own member row" on "public"."members";
drop policy if exists "Users can update their own member row" on "public"."members";

drop policy if exists "Admins can view all sepa rows" on "public"."sepa";
drop policy if exists "Users can insert their own sepa row" on "public"."sepa";
drop policy if exists "Users can read their own sepa row" on "public"."sepa";
drop policy if exists "Users can update their own sepa row" on "public"."sepa";

drop policy if exists "Admins manage reimbursements" on "public"."reimbursements";
drop policy if exists "Members insert own reimbursements" on "public"."reimbursements";
drop policy if exists "Members read own reimbursements" on "public"."reimbursements";

drop function if exists "public"."decrypt_iban_db"("bytea", "text");
drop function if exists "public"."decrypt_ibans_batch_db"("bytea"[], "text");
drop function if exists "public"."encrypt_iban_db"("text", "text");
