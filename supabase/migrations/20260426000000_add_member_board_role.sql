alter table "public"."members"
    add column if not exists "board_role" text;

update "public"."members"
set "board_role" = 'Board Member'
where "department" = 'Board'
  and "member_role" not in ('President', 'Vice-President')
  and "board_role" is null;

update "public"."members"
set "department" = null
where "department" = 'Board';

alter table "public"."members"
    drop constraint if exists "members_board_role_check";

alter table "public"."members"
    add constraint "members_board_role_check"
    check ("board_role" is null or "board_role" = 'Board Member');

create index if not exists "members_board_role_idx"
    on "public"."members" ("board_role")
    where "board_role" is not null;
