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

// Canonical member roles. Keep in sync with:
//   - `supabase/migrations/20260423160500_member_role_enum_and_alumni.sql`
//   - `client/src/lib/constants.ts` (MEMBER_ROLES)
export const MEMBER_ROLES = [
	"Member",
	"Team Lead",
	"Vice-President",
	"President",
	"Alumni",
] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

const RoleSchema = z.object({
	member_role: z.enum(MEMBER_ROLES),
});

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const DateOnlySchema = z
	.string()
	.regex(DATE_ONLY_REGEX, "Expected date in YYYY-MM-DD format")
	.refine((value) => {
		const [year, month, day] = value.split("-").map(Number);
		const date = new Date(Date.UTC(year, month - 1, day));
		return (
			date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
		);
	}, "Invalid calendar date");

const NullableDateOnlySchema = z
	.string()
	.optional()
	.nullable()
	.transform((value) => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	})
	.pipe(DateOnlySchema.nullable());

const RoleHistoryCreateSchema = z
	.object({
		role: z.enum(MEMBER_ROLES),
		semester: z.string().optional().nullable(),
		started_at: NullableDateOnlySchema,
		ended_at: NullableDateOnlySchema,
		note: z.string().optional().nullable(),
	})
	.refine(
		(data) =>
			!(data.started_at && data.ended_at && data.ended_at < data.started_at),
		{
			message: "ended_at must be on or after started_at",
			path: ["ended_at"],
		},
	);

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
					// biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
					(members || []).map((member: any) => String(member.user_id)),
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
					? // biome-ignore lint/suspicious/noExplicitAny: Vercel type resolution workaround
						joined.filter((member: any) =>
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

	server.patch<{ Params: { userId: string } }>(
		"/admin/members/:userId/role",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = RoleSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid member_role",
					details: parsed.error.flatten(),
				});
			}
			const role: MemberRole = parsed.data.member_role;

			// Alumni <-> inactive invariant: DB trigger enforces this on write,
			// but we set both explicitly so behavior is observable without relying
			// on a BEFORE trigger (which mocks in tests do not simulate).
			const update = {
				member_role: role,
				active: role !== "Alumni",
			};

			const { data, error } = await getSupabase()
				.from("members")
				.update(update)
				.eq("user_id", userId)
				.select()
				.single();

			if (error) {
				if (error.code === "PGRST116") {
					return reply.status(404).send({ error: "Member not found" });
				}
				request.log.error({ err: error }, "Failed to update member role");
				throw new DatabaseError();
			}

			return decryptRecord(data, SENSITIVE_MEMBER_FIELDS);
		},
	);

	// --- member_role_history CRUD (admin-only) ---
	//
	// History rows are ordered so the UI can render a timeline. Start/end dates
	// are optional strings (YYYY-MM-DD) because admins often only know the
	// semester label (e.g. "WS25/26").

	server.get<{ Params: { userId: string } }>(
		"/admin/members/:userId/role-history",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, _reply) => {
			const { userId } = request.params;
			const { data, error } = await getSupabase()
				.from("member_role_history")
				.select("*")
				.eq("user_id", userId)
				.order("started_at", { ascending: false });

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to fetch member role history",
				);
				throw new DatabaseError();
			}
			return data ?? [];
		},
	);

	server.post<{ Params: { userId: string } }>(
		"/admin/members/:userId/role-history",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId } = request.params;
			const parsed = RoleHistoryCreateSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply.status(400).send({
					error: "Invalid role history entry",
					details: parsed.error.flatten(),
				});
			}

			const payload = {
				user_id: userId,
				role: parsed.data.role,
				semester: parsed.data.semester ?? null,
				started_at: parsed.data.started_at ?? null,
				ended_at: parsed.data.ended_at ?? null,
				note: parsed.data.note ?? null,
			};

			const { data, error } = await getSupabase()
				.from("member_role_history")
				.insert(payload)
				.select()
				.single();

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to insert member role history entry",
				);
				throw new DatabaseError();
			}

			return reply.status(201).send(data);
		},
	);

	server.delete<{ Params: { userId: string; id: string } }>(
		"/admin/members/:userId/role-history/:id",
		{ preHandler: [authenticate, requireAdmin] },
		async (request, reply) => {
			const { userId, id } = request.params;
			const { error } = await getSupabase()
				.from("member_role_history")
				.delete()
				.eq("id", id)
				.eq("user_id", userId);

			if (error) {
				request.log.error(
					{ err: error },
					"Failed to delete member role history entry",
				);
				throw new DatabaseError();
			}
			return reply.status(204).send();
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
