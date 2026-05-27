create table if not exists "public"."member_agreements" (
    "user_id" uuid not null references "public"."members"("user_id") on delete cascade,
    "sepa_mandate_agreed" boolean default false not null,
    "privacy_policy_agreed" boolean default false not null,
    "data_privacy_notice_agreed" boolean default false not null,
    "created_at" timestamp with time zone default "now"() not null,
    "updated_at" timestamp with time zone default "now"() not null,
    constraint "member_agreements_pkey" primary key ("user_id")
);

insert into "public"."member_agreements" (
    "user_id",
    "sepa_mandate_agreed",
    "privacy_policy_agreed"
)
select
    "sepa"."user_id",
    "sepa"."mandate_agreed",
    "sepa"."privacy_agreed"
from "public"."sepa"
inner join "public"."members"
    on "members"."user_id" = "sepa"."user_id"
on conflict ("user_id") do update set
    "sepa_mandate_agreed" = excluded."sepa_mandate_agreed",
    "privacy_policy_agreed" = excluded."privacy_policy_agreed",
    "updated_at" = "now"();

alter table "public"."member_agreements" enable row level security;

drop policy if exists "Admins can view all member agreement rows" on "public"."member_agreements";
create policy "Admins can view all member agreement rows"
    on "public"."member_agreements"
    for select
    using (exists (
        select 1
        from "public"."user_roles"
        where "user_roles"."user_id" = "auth"."uid"()
            and "user_roles"."role" = 'admin'::"text"
    ));

drop policy if exists "Users can insert their own member agreement row" on "public"."member_agreements";
create policy "Users can insert their own member agreement row"
    on "public"."member_agreements"
    for insert
    with check ("auth"."uid"() = "user_id");

drop policy if exists "Users can read their own member agreement row" on "public"."member_agreements";
create policy "Users can read their own member agreement row"
    on "public"."member_agreements"
    for select
    using ("auth"."uid"() = "user_id");

drop policy if exists "Users can update their own member agreement row" on "public"."member_agreements";
create policy "Users can update their own member agreement row"
    on "public"."member_agreements"
    for update
    using ("auth"."uid"() = "user_id");

grant all on table "public"."member_agreements" to "anon";
grant all on table "public"."member_agreements" to "authenticated";
grant all on table "public"."member_agreements" to "service_role";
