import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkAdminRole, ensureOwnerOrAdmin } from "../lib/auth.js";
import { getAuthEmails } from "../lib/authEmails.js";
import {
	DatabaseError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../lib/errors.js";
import {
	addCvVersion,
	createCvSignedUrl,
	downloadCvObject,
	getCurrentCv,
	MAX_CV_BYTES,
	type MemberCvRow,
} from "../lib/memberCvs.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const UploadCvSchema = z.object({
	filename: z.string().trim().min(1).max(255),
	cv_base64: z.string().trim().min(1),
});

const ConsentSchema = z.object({
	consent: z.boolean(),
});

function stripDataUrlPrefix(value: string): string {
	const marker = "base64,";
	const markerIndex = value.indexOf(marker);
	return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
}

// Public-facing CV metadata (never exposes storage internals to clients).
function toCvMetadata(row: MemberCvRow) {
	return {
		id: row.id,
		version: row.version,
		source: row.source,
		original_filename: row.original_filename,
		size_bytes: row.size_bytes,
		mime_type: row.mime_type,
		sha256: row.sha256,
		uploaded_at: row.uploaded_at,
		is_current: row.is_current,
	};
}

function constantTimeEquals(a: string, b: string): boolean {
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) {
		return false;
	}
	return timingSafeEqual(aBuf, bBuf);
}

export async function cvRoutes(server: FastifyInstance) {
	server.get<{ Params: { userId: string } }>(
		"/members/:userId/cv",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own CV",
			);

			const current = await getCurrentCv(userId);
			return { cv: current ? toCvMetadata(current) : null };
		},
	);

	server.post<{ Params: { userId: string } }>(
		"/members/:userId/cv",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only upload your own CV",
			);

			const body = UploadCvSchema.parse(request.body);
			const base64 = stripDataUrlPrefix(body.cv_base64);
			let buffer: Buffer;
			try {
				buffer = Buffer.from(base64, "base64");
			} catch {
				throw new ValidationError("CV file is not valid base64");
			}
			if (buffer.length === 0) {
				throw new ValidationError("CV file is empty");
			}
			if (buffer.length > MAX_CV_BYTES) {
				throw new ValidationError("CV file is too large (max 5 MB)");
			}

			const isAdmin = await checkAdminRole(user.id);
			const source =
				isAdmin && user.id !== userId ? "admin_upload" : "member_upload";

			const row = await addCvVersion({
				userId,
				buffer,
				originalFilename: body.filename,
				source,
				uploadedByUserId: user.id,
			});

			return reply.status(201).send({ cv: toCvMetadata(row) });
		},
	);

	server.get<{
		Params: { userId: string };
		Querystring: { download?: string | string[] };
	}>(
		"/members/:userId/cv/current/download",
		{ preHandler: authenticate },
		async (request, reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only download your own CV",
			);

			const current = await getCurrentCv(userId);
			if (!current) {
				throw new NotFoundError("No current CV for this member");
			}

			const buffer = await downloadCvObject(current);
			const wantsAttachment =
				request.query.download === "1" || request.query.download === "true";
			const disposition = wantsAttachment ? "attachment" : "inline";

			reply
				.type(current.mime_type)
				.header("Cache-Control", "private, max-age=300")
				.header(
					"Content-Disposition",
					`${disposition}; filename="${current.original_filename}"`,
				);
			return reply.send(buffer);
		},
	);

	server.get<{ Params: { userId: string } }>(
		"/members/:userId/cv/consent",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own consent",
			);

			const { data, error } = await getSupabase()
				.from("members")
				.select("partner_sharing_consent_at")
				.eq("user_id", userId)
				.maybeSingle();
			if (error) {
				request.log.error({ err: error }, "Failed to read CV consent");
				throw new DatabaseError();
			}
			return {
				partner_sharing_consent_at:
					(data as { partner_sharing_consent_at: string | null } | null)
						?.partner_sharing_consent_at ?? null,
			};
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/members/:userId/cv/consent",
		{ preHandler: authenticate },
		async (request) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			// Owner or admin may reach this route; the opt-in itself is restricted
			// to the member below (admins may only clear/revoke).
			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only change your own consent",
			);

			const body = ConsentSchema.parse(request.body);

			// GDPR-grade opt-in: only the member themselves may grant consent.
			// Admins (or anyone acting on another member's behalf) may at most
			// clear it. This prevents an admin from opting a member into partner
			// sharing.
			if (body.consent && user.id !== userId) {
				throw new ForbiddenError(
					"Only the member can grant partner-sharing consent",
				);
			}

			const consentAt = body.consent ? new Date().toISOString() : null;
			const consentedBy = body.consent ? user.id : null;

			const { data, error } = await getSupabase()
				.from("members")
				.update({
					partner_sharing_consent_at: consentAt,
					partner_sharing_consented_by_user_id: consentedBy,
				})
				.eq("user_id", userId)
				.select("partner_sharing_consent_at")
				.single();
			if (error) {
				request.log.error({ err: error }, "Failed to update CV consent");
				throw new DatabaseError();
			}
			return {
				partner_sharing_consent_at: (
					data as { partner_sharing_consent_at: string | null }
				).partner_sharing_consent_at,
			};
		},
	);
}

interface ActiveMemberRow {
	user_id: string;
	given_name: string | null;
	surname: string | null;
	batch: string | null;
	department: string | null;
	linkedin_profile_url: string | null;
	partner_sharing_consent_at: string | null;
}

// Server-to-server export consumed by the Partner Portal. Authenticated with a
// static bearer token (PARTNER_EXPORT_TOKEN), NOT the member JWT. See
// docs/member-cvs.md for the contract.
export async function partnerExportRoutes(server: FastifyInstance) {
	server.get<{ Querystring: { semester?: string } }>(
		"/internal/partner-portal/cv-export",
		async (request) => {
			const expectedToken = process.env.PARTNER_EXPORT_TOKEN?.trim();
			if (!expectedToken) {
				request.log.error("PARTNER_EXPORT_TOKEN is not configured");
				throw new UnauthorizedError("Partner export is not configured");
			}
			const header = request.headers.authorization ?? "";
			const presented = header.startsWith("Bearer ")
				? header.slice("Bearer ".length).trim()
				: "";
			if (!presented || !constantTimeEquals(presented, expectedToken)) {
				throw new UnauthorizedError("Invalid partner export token");
			}

			const semester = request.query.semester?.trim() || null;
			const supabase = getSupabase();

			const { data: members, error: membersError } = await supabase
				.from("members")
				.select(
					"user_id, given_name, surname, batch, department, linkedin_profile_url, partner_sharing_consent_at",
				)
				.eq("member_status", "active");
			if (membersError) {
				request.log.error(
					{ err: membersError },
					"Failed to read active members for export",
				);
				throw new DatabaseError();
			}

			const activeMembers = (members ?? []) as ActiveMemberRow[];
			const consented = activeMembers.filter(
				(m) => m.partner_sharing_consent_at !== null,
			);

			const emails = await getAuthEmails(consented.map((m) => m.user_id));

			const exported: unknown[] = [];
			const revoked: { member_manager_user_id: string; reason: string }[] = [];

			for (const member of consented) {
				const current = await getCurrentCv(member.user_id);
				if (!current) {
					// Consented but no shareable current CV (revoked or deleted). This
					// is a real revocation signal: the Partner Portal should reconcile
					// any prior snapshot item for this member.
					revoked.push({
						member_manager_user_id: member.user_id,
						reason: "cv_revoked",
					});
					continue;
				}

				const downloadUrl = await createCvSignedUrl(current);
				exported.push({
					member_manager_user_id: member.user_id,
					given_name: member.given_name ?? "",
					surname: member.surname ?? "",
					email: emails.get(member.user_id) ?? "",
					batch: member.batch ?? null,
					department: member.department ?? null,
					linkedin_profile_url: member.linkedin_profile_url ?? null,
					cv: {
						id: current.id,
						version: current.version,
						sha256: current.sha256,
						filename: current.original_filename,
						size_bytes: current.size_bytes,
						mime_type: current.mime_type,
						download_url: downloadUrl,
						uploaded_at: current.uploaded_at,
					},
				});
			}

			// Consent withdrawal is reconciled by the Partner Portal diffing its
			// snapshot against `members[]` (present in snapshot, absent here =
			// withdrawn). We do not enumerate every non-consenting active member
			// here, which would be noise. `revoked[]` carries only positive CV
			// revocation signals.
			return {
				semester,
				generated_at: new Date().toISOString(),
				members: exported,
				revoked,
			};
		},
	);
}
