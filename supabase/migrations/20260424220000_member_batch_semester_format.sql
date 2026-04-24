begin;

update "public"."members"
set "batch" = null
where "batch" is not null
  and btrim("batch") = '';

update "public"."members"
set "batch" = upper(btrim("batch"))
where "batch" is not null;

update "public"."members"
set "batch" = regexp_replace("batch", '^WS([0-9]{2})/[0-9]{2}$', 'WS\1')
where "batch" ~ '^WS[0-9]{2}/[0-9]{2}$';

update "public"."members"
set "batch" = regexp_replace("batch", '^SS([0-9]{2})/[0-9]{2}$', 'SS\1')
where "batch" ~ '^SS[0-9]{2}/[0-9]{2}$';

alter table "public"."members"
    drop constraint if exists "members_batch_format_check";

alter table "public"."members"
    add constraint "members_batch_format_check"
        check (
            "batch" is null
            or "batch" ~ '^(WS|SS)(2[0-9]|[3-9][0-9])$'
        ) not valid;

commit;
