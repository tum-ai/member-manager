-- Only members of the TUM.ai Slack workspace may create an account.
--
-- "Sign in with Slack" (`slack_oidc`) authenticates users of any Slack
-- workspace, and `handle_new_user` used to turn every new auth user into an
-- active member. Supabase stores the user's workspace as
-- `custom_claims."https://slack.com/team_id"` in the user metadata it writes
-- at sign-up. A Slack sign-up from any other workspace now raises, which rolls
-- back the `auth.users` insert, so no auth user, member row or role is
-- created. The auth server reports this to the client as "Database error
-- saving new user".
--
-- Accounts created by other providers (the seeded local email users,
-- admin-created users) are unchanged. The server's `authenticate` middleware
-- applies the same rule to every API request
-- (`server/src/lib/slackWorkspace.ts`, which must list the same team ID).

create or replace function "public"."handle_new_user"() returns "trigger"
    language "plpgsql" security definer
    set search_path = ''
    as $$
declare
    allowed_slack_team_ids constant text[] := array['T01288YLP16'];
    slack_team_id text;
begin
    if new.raw_app_meta_data->>'provider' = 'slack_oidc'
        or new.raw_user_meta_data->>'iss' = 'https://slack.com'
    then
        slack_team_id := new.raw_user_meta_data->'custom_claims'->>'https://slack.com/team_id';
        if slack_team_id is null or not (slack_team_id = any (allowed_slack_team_ids)) then
            raise exception 'Slack workspace % is not allowed to sign in', coalesce(slack_team_id, '<none>')
                using errcode = 'insufficient_privilege';
        end if;
    end if;

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
