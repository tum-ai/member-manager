import type { FastifyInstance } from "fastify";
import { electronicFormatIBAN, isValidIBAN } from "ibantools";
import { z } from "zod";
import { ForbiddenError, NotFoundError, isNotFoundError } from "../lib/errors.js";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

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
    async (request, reply) => {
      const body = SepaSchema.parse(request.body);
      const user = (request as any).user;

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

  server.get(
    "/sepa/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = (request as any).user;

      const { data, error } = await supabase
        .from("sepa")
        .select("*")
        .eq("user_id", user.id)
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

  server.put(
    "/sepa/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = (request as any).user;
      const body = SepaSchema.parse(request.body);

      if (user.id !== body.user_id) {
        throw new ForbiddenError("User ID mismatch");
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
