import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthEmails } from "../lib/authEmails.js";
import { DatabaseError } from "../lib/errors.js";
import {
	decryptRecord,
	SENSITIVE_MEMBER_FIELDS,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const QuerySchema = z.object({
	page: z.string().transform(Number).default("1"),
	limit: z.string().transform(Number).default("10"),
	search: z.string().optional(),
	active: z.string().optional(),
	mandate_agreed: z.string().optional(),
	privacy_agreed: z.string().optional(),
	sort_by: z.string().default("surname"),
	sort_asc: z
		.string()
		.transform((val) => val === "true")
		.default("true"),
});

const StatusSchema = z.object({
	active: z.boolean(),
});

export async function adminRoutes(server: FastifyInstance) {
	server.get(
		"/admin/members",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const query = QuerySchema.parse(request.query);
			const {
				page,
				limit,
				search,
				active,
				mandate_agreed,
				privacy_agreed,
				sort_by,
				sort_asc,
			} = query;
			const from = (page - 1) * limit;
			const to = from + limit - 1;

			// Determine if we need to filter on SEPA, which requires an inner join logic
			// for the filter to work on the parent rows in PostgREST.
			const filterSepa =
				(mandate_agreed !== undefined && mandate_agreed !== "") ||
				(privacy_agreed !== undefined && privacy_agreed !== "");

			const selectQuery = filterSepa ? "*, sepa!inner(*)" : "*, sepa(*)";

			let dbQuery = getSupabase().from("members").select(selectQuery);

			if (active !== undefined && active !== "") {
				dbQuery = dbQuery.eq("active", active === "true");
			}

			if (mandate_agreed !== undefined && mandate_agreed !== "") {
				dbQuery = dbQuery.eq("sepa.mandate_agreed", mandate_agreed === "true");
			}
			if (privacy_agreed !== undefined && privacy_agreed !== "") {
				dbQuery = dbQuery.eq("sepa.privacy_agreed", privacy_agreed === "true");
			}

			const { data: members, error: membersError } = await dbQuery;

			if (membersError) {
				request.log.error({ err: membersError }, "Failed to fetch members");
				throw new DatabaseError();
			}

			try {
				const emailMap = await getAuthEmails(
					(members || []).map((member) => String(member.user_id)),
				);

				// Transform data to ensure sepa is an object (Supabase might return array)
				// biome-ignore lint/suspicious/noExplicitAny: complex supabase return type
				const joined = (members || []).map((m: any) => ({
					...decryptRecord(m, SENSITIVE_MEMBER_FIELDS),
					email: emailMap.get(String(m.user_id)) ?? "",
					sepa: decryptRecord(
						Array.isArray(m.sepa) ? m.sepa[0] || {} : m.sepa || {},
						SENSITIVE_SEPA_FIELDS,
					),
				}));

				const normalizedSearch = search?.trim().toLowerCase();
				const filtered = normalizedSearch
					? joined.filter((member) =>
							`${member.given_name} ${member.surname} ${member.email}`
								.toLowerCase()
								.includes(normalizedSearch),
						)
					: joined;

				const getSortValue = (member: (typeof filtered)[number]) => {
					// biome-ignore lint/suspicious/noExplicitAny: dynamic admin sorting
					return (member as any)[sort_by] ?? member.sepa?.[sort_by] ?? "";
				};

				const sorted = [...filtered].sort((left, right) => {
					const leftValue = String(getSortValue(left));
					const rightValue = String(getSortValue(right));
					const comparison = leftValue.localeCompare(rightValue);
					return sort_asc ? comparison : comparison * -1;
				});

				return {
					data: sorted.slice(from, to + 1),
					total: filtered.length,
					page,
					limit,
				};
			} catch (authError) {
				request.log.error({ err: authError }, "Failed to fetch auth emails");
				throw new DatabaseError();
			}
		},
	);

	server.patch(
		"/admin/members/:userId/status",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { userId } = request.params as { userId: string };
			const body = StatusSchema.parse(request.body);

			const { error } = await getSupabase()
				.from("members")
				.update({ active: body.active })
				.eq("user_id", userId);

			if (error) {
				request.log.error({ err: error }, "Failed to update member status");
				throw new DatabaseError();
			}

			return { message: "Status updated successfully" };
		},
	);
}
