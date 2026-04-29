update "public"."members"
set "department" = null
where "department" in ('Board', 'Research');
