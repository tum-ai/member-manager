import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
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
		async (request, reply) => {
			try {
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
				let dbQuery = supabase.from("members").select("*", { count: "exact" });

				if (search) {
					dbQuery = dbQuery.or(
						`given_name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%`,
					);
				}

				if (active !== undefined && active !== "") {
					dbQuery = dbQuery.eq("active", active === "true");
				}

				if (
					["surname", "given_name", "email", "created_at"].includes(sort_by)
				) {
					dbQuery = dbQuery
						.order(sort_by, { ascending: sort_asc })
						.range(from, to);
				} else {
					dbQuery = dbQuery.range(from, to);
				}

				const { data: members, count, error: membersError } = await dbQuery;

				if (membersError) throw membersError;

				if (!members || members.length === 0) {
					return { data: [], total: 0, page, limit };
				}

				// 4. Fetch SEPA data for these members
				const userIds = members.map((m) => m.user_id);
				const { data: sepaData, error: sepaError } = await supabase
					.from("sepa")
					.select("*")
					.in("user_id", userIds);

				if (sepaError) throw sepaError;

				// 5. Join and Filter by SEPA fields
				let joined = members.map((member) => ({
					...member,
					sepa: sepaData?.find((s) => s.user_id === member.user_id) || {},
				}));

				if (mandate_agreed !== undefined && mandate_agreed !== "") {
					const boolVal = mandate_agreed === "true";
					joined = joined.filter((m) => !!m.sepa.mandate_agreed === boolVal);
				}
				if (privacy_agreed !== undefined && privacy_agreed !== "") {
					const boolVal = privacy_agreed === "true";
					joined = joined.filter((m) => !!m.sepa.privacy_agreed === boolVal);
				}

				return {
					data: joined,
					total: count || 0,
					page,
					limit,
				};
			} catch (err: any) {
				server.log.error(err);
				return reply
					.status(500)
					.send({ error: err.message || "Internal Server Error" });
			}
		},
	);

	server.patch(
		"/admin/members/:userId/status",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			try {
				const { userId } = request.params as { userId: string };
				const body = StatusSchema.parse(request.body);

				const { error } = await supabase
					.from("members")
					.update({ active: body.active })
					.eq("user_id", userId);

				if (error) throw error;

				return { message: "Status updated successfully" };
			} catch (err: any) {
				if (err instanceof ZodError) {
					return reply.status(400).send({ error: "Validation Error", details: err.issues });
				}
				server.log.error(err);
				return reply
					.status(500)
					.send({ error: err.message || "Internal Server Error" });
			}
		},
	);
}
