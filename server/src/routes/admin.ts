import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
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
			// 1. Parse Query Params
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

			// 3. Build Query
			// Determine if we need to filter on SEPA, which requires an inner join logic
			// for the filter to work on the parent rows in PostgREST.
			const filterSepa =
				(mandate_agreed !== undefined && mandate_agreed !== "") ||
				(privacy_agreed !== undefined && privacy_agreed !== "");

			const selectQuery = filterSepa ? "*, sepa!inner(*)" : "*, sepa(*)";

			let dbQuery = supabase
				.from("members")
				.select(selectQuery, { count: "exact" });

			if (search) {
				dbQuery = dbQuery.or(
					`given_name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%`,
				);
			}

			if (active !== undefined && active !== "") {
				dbQuery = dbQuery.eq("active", active === "true");
			}

			if (mandate_agreed !== undefined && mandate_agreed !== "") {
				dbQuery = dbQuery.eq("sepa.mandate_agreed", mandate_agreed === "true");
			}
			if (privacy_agreed !== undefined && privacy_agreed !== "") {
				dbQuery = dbQuery.eq("sepa.privacy_agreed", privacy_agreed === "true");
			}

			if (["surname", "given_name", "email", "created_at"].includes(sort_by)) {
				dbQuery = dbQuery
					.order(sort_by, { ascending: sort_asc })
					.range(from, to);
			} else {
				dbQuery = dbQuery.range(from, to);
			}

			const { data: members, count, error: membersError } = await dbQuery;

			if (membersError) throw membersError;

			// Transform data to ensure sepa is an object (Supabase might return array)
			// biome-ignore lint/suspicious/noExplicitAny: complex supabase return type
			const joined = (members || []).map((m: any) => ({
				...m,
				sepa: Array.isArray(m.sepa) ? m.sepa[0] || {} : m.sepa || {},
			}));

			return {
				data: joined,
				total: count || 0,
				page,
				limit,
			};
		},
	);

	server.patch(
		"/admin/members/:userId/status",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { userId } = request.params as { userId: string };
			const body = StatusSchema.parse(request.body);

			const { error } = await supabase
				.from("members")
				.update({ active: body.active })
				.eq("user_id", userId);

			if (error) throw error;

			return { message: "Status updated successfully" };
		},
	);
}
