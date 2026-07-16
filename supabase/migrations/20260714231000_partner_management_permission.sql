begin;

insert into "public"."department_permissions" ("department", "permissions")
values (
	'Partners & Sponsors',
	'["contracts.create", "partners.manage"]'::jsonb
)
on conflict ("department") do update
set
	"permissions" = case
		when "department_permissions"."permissions" @> '["partners.manage"]'::jsonb
			then "department_permissions"."permissions"
		else "department_permissions"."permissions" || '["partners.manage"]'::jsonb
	end,
	"updated_at" = now();

commit;
