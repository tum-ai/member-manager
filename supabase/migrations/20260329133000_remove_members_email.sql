CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.members (
    user_id, given_name, surname, date_of_birth, street, number, postal_code, city, country
  )
  VALUES (
    NEW.id, '', '', '2000-01-01', '', '', '', '', ''
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS "public"."prevent_email_update"();

ALTER TABLE "public"."members"
    DROP COLUMN IF EXISTS "email";
