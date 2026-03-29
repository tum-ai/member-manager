import type { FastifyInstance } from "fastify";
import { electronicFormatIBAN, isValidIBAN } from "ibantools";
import { z } from "zod";
import { ensureOwnerOrAdmin } from "../lib/auth.js";
import {
	DatabaseError,
	ForbiddenError,
	isNotFoundError,
	NotFoundError,
} from "../lib/errors.js";
import {
	decryptRecord,
	encryptRecord,
	SENSITIVE_SEPA_FIELDS,
} from "../lib/sensitiveData.js";
import { getSupabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/index.js";

const SepaSchema = z.object({
	user_id: z.string(),
	iban: z
		.string()
		.transform((val) => electronicFormatIBAN(val))
		.refine((val): val is string => !!val && isValidIBAN(val), {
			message: "Invalid IBAN",
		}),
	bic: z.string().optional(),
	bank_name: z.string(),
	mandate_agreed: z.boolean(),
	privacy_agreed: z.boolean(),
});

const UpdateSepaSchema = SepaSchema.omit({
	user_id: true,
});

export async function sepaRoutes(server: FastifyInstance) {
	server.post(
		"/sepa",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const body = SepaSchema.parse(request.body);
			const user = (request as AuthenticatedRequest).user;

			// Verify ownership
			if (body.user_id !== user.id) {
				throw new ForbiddenError("User ID mismatch");
			}

			const encryptedBody = encryptRecord(body, SENSITIVE_SEPA_FIELDS);
			const { error } = await getSupabase()
				.from("sepa")
				.insert([encryptedBody]);

			if (error) {
				request.log.error({ err: error }, "Failed to insert SEPA data");
				throw new DatabaseError();
			}

			return { message: "SEPA info added successfully" };
		},
	);

	server.get<{ Params: { userId: string } }>(
		"/sepa/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only view your own SEPA data",
			);

			const { data, error } = await getSupabase()
				.from("sepa")
				.select("*")
				.eq("user_id", userId)
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("SEPA data not found");
			}
			if (error) {
				request.log.error({ err: error }, "Failed to fetch SEPA data");
				throw new DatabaseError();
			}

			return decryptRecord(data, SENSITIVE_SEPA_FIELDS);
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/sepa/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;

			await ensureOwnerOrAdmin(
				user.id,
				userId,
				"You can only update your own SEPA data",
			);

			const body = UpdateSepaSchema.parse(request.body);

			const encryptedBody = encryptRecord(body, SENSITIVE_SEPA_FIELDS);
			const { data, error } = await getSupabase()
				.from("sepa")
				.upsert(
					{ ...encryptedBody, user_id: userId },
					{ onConflict: "user_id" },
				)
				.select()
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("SEPA data not found");
			}
			if (error) {
				request.log.error({ err: error }, "Failed to upsert SEPA data");
				throw new DatabaseError();
			}

			return decryptRecord(data, SENSITIVE_SEPA_FIELDS);
		},
	);
}
