-- Remove unused member profile fields and make the address optional.

ALTER TABLE "public"."members"
    DROP COLUMN IF EXISTS "skills",
    DROP COLUMN IF EXISTS "profile_picture_url",
    ALTER COLUMN "street" DROP NOT NULL,
    ALTER COLUMN "number" DROP NOT NULL,
    ALTER COLUMN "postal_code" DROP NOT NULL,
    ALTER COLUMN "city" DROP NOT NULL,
    ALTER COLUMN "country" DROP NOT NULL;
