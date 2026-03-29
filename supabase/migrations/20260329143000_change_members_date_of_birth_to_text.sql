ALTER TABLE "public"."members"
    ALTER COLUMN "date_of_birth" TYPE "text"
    USING "date_of_birth"::"text";
