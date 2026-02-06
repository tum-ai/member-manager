

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."decrypt_iban_db"("encrypted_iban" "bytea", "encryption_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- pgp_sym_decrypt decrypts the PGP-formatted bytea.
    RETURN pgp_sym_decrypt(encrypted_iban, encryption_key);
END;
$$;


ALTER FUNCTION "public"."decrypt_iban_db"("encrypted_iban" "bytea", "encryption_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_ibans_batch_db"("encrypted_ibans" "bytea"[], "encryption_key" "text") RETURNS TABLE("decrypted_iban" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT pgp_sym_decrypt(ibans, encryption_key)
    FROM unnest(encrypted_ibans) AS ibans;
END;
$$;


ALTER FUNCTION "public"."decrypt_ibans_batch_db"("encrypted_ibans" "bytea"[], "encryption_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_iban_db"("iban_to_encrypt" "text", "encryption_key" "text") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- pgp_sym_encrypt encrypts the text using AES256 by default.
    -- It returns a PGP-formatted bytea.
    RETURN pgp_sym_encrypt(iban_to_encrypt, encryption_key);
END;
$$;


ALTER FUNCTION "public"."encrypt_iban_db"("iban_to_encrypt" "text", "encryption_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert into members table
  INSERT INTO public.members (
    user_id, email, given_name, surname, date_of_birth, street, number, postal_code, city, country
  )
  VALUES (
    NEW.id, NEW.email, '', '', '2000-01-01', '', '', '', '', ''
  );

  -- Insert default role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_email_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Email changes are not allowed';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_email_update"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surname" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "user_id" "uuid" NOT NULL,
    "given_name" "text" NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "street" "text" NOT NULL,
    "number" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "city" "text" NOT NULL,
    "country" "text" NOT NULL,
    "title" "text",
    "active" boolean DEFAULT true NOT NULL,
    "salutation" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sepa" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "iban" "text",
    "bic" "text",
    "mandate_agreed" boolean DEFAULT false NOT NULL,
    "privacy_agreed" boolean DEFAULT false NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bank_name" "text" DEFAULT ''::"text" NOT NULL,
    "id_uuid" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."sepa" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_profiles" WITH ("security_invoker"='on') AS
 SELECT "u"."id" AS "user_id",
    "u"."email",
    "m"."given_name",
    "m"."surname",
    "m"."active"
   FROM ("auth"."users" "u"
     JOIN "public"."members" "m" ON (("u"."id" = "m"."user_id")));


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."sepa"
    ADD CONSTRAINT "sepa_pkey" PRIMARY KEY ("id_uuid");



ALTER TABLE ONLY "public"."sepa"
    ADD CONSTRAINT "sepa_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can view all members" ON "public"."members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all sepa rows" ON "public"."sepa" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow insert for authenticated users" ON "public"."members" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow user to read own member row" ON "public"."members" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own member row" ON "public"."members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own sepa row" ON "public"."sepa" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own member row" ON "public"."members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own sepa row" ON "public"."sepa" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own member row" ON "public"."members" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own sepa row" ON "public"."sepa" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sepa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_read_their_row" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."decrypt_iban_db"("encrypted_iban" "bytea", "encryption_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_iban_db"("encrypted_iban" "bytea", "encryption_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_iban_db"("encrypted_iban" "bytea", "encryption_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_ibans_batch_db"("encrypted_ibans" "bytea"[], "encryption_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_ibans_batch_db"("encrypted_ibans" "bytea"[], "encryption_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_ibans_batch_db"("encrypted_ibans" "bytea"[], "encryption_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_iban_db"("iban_to_encrypt" "text", "encryption_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_iban_db"("iban_to_encrypt" "text", "encryption_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_iban_db"("iban_to_encrypt" "text", "encryption_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_email_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_email_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_email_update"() TO "service_role";


















GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."sepa" TO "anon";
GRANT ALL ON TABLE "public"."sepa" TO "authenticated";
GRANT ALL ON TABLE "public"."sepa" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























drop extension if exists "pg_net";


-- Removed system triggers that cause issues locally
-- CREATE TRIGGER on_auth_user_created ... is fine, it uses public.handle_new_user which IS defined.

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The following triggers use storage functions that are not defined in this migration
-- and seem to be internal system triggers.
-- CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();
-- CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();
-- CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();
-- CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();
-- CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


