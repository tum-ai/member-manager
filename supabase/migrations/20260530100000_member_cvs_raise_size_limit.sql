begin;

-- Raise the member CV size cap from 5 MB to 10 MB. Mirrors the API/client
-- limits (MAX_CV_BYTES) and the local config.toml bucket limit. 10 MiB =
-- 10 * 1024 * 1024 = 10485760 bytes.

alter table "public"."member_cvs"
    drop constraint if exists "member_cvs_size_bytes_check";

alter table "public"."member_cvs"
    add constraint "member_cvs_size_bytes_check"
        check ("size_bytes" > 0 and "size_bytes" <= 10485760);

update "storage"."buckets"
    set "file_size_limit" = 10485760
    where "id" = 'member-cvs';

commit;
