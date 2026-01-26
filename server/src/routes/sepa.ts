import type { FastifyInstance } from "fastify";
import { electronicFormatIBAN, isValidIBAN } from "ibantools";
import { z } from "zod";
import { checkAdminRole } from "../lib/auth.js";
import {
	ForbiddenError,
	isNotFoundError,
	NotFoundError,
} from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
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

			const { error } = await supabase.from("sepa").insert([body]);

			if (error) {
				throw error;
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

			if (userId !== user.id) {
				const isAdmin = await checkAdminRole(user.id);
				if (!isAdmin) {
					throw new ForbiddenError("You can only view your own SEPA data");
				}
			}

			const { data, error } = await supabase
				.from("sepa")
				.select("*")
				.eq("user_id", userId)
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("SEPA data not found");
			}
			if (error) {
				throw error;
			}

			return data;
		},
	);

	server.put<{ Params: { userId: string } }>(
		"/sepa/:userId",
		{ preHandler: authenticate },
		async (request, _reply) => {
			const { userId } = request.params;
			const user = (request as AuthenticatedRequest).user;
			const body = SepaSchema.parse(request.body);

			if (userId !== user.id) {
				const isAdmin = await checkAdminRole(user.id);
				if (!isAdmin) {
					throw new ForbiddenError("You can only update your own SEPA data");
				}
			}

			// Ensure we are updating the correct user
			if (body.user_id !== userId) {
				throw new ForbiddenError("User ID mismatch in body");
			}

			const { data, error } = await supabase
				.from("sepa")
				.upsert(body, { onConflict: "user_id" })
				.select()
				.single();

			if (isNotFoundError(error)) {
				throw new NotFoundError("SEPA data not found");
			}
			if (error) {
				throw error;
			}

			return data;
		},
	);
}
