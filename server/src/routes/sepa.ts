import type { FastifyInstance } from "fastify";
import { electronicFormatIBAN, isValidIBAN } from "ibantools";
import { ZodError, z } from "zod";
import { supabase } from "../lib/supabase.js";
import { authenticate } from "../middleware/auth.js";

const SepaSchema = z.object({
  user_id: z.string(),
  iban: z
    .string()
    .transform((val) => electronicFormatIBAN(val))
    .refine((val): val is string => !!val && isValidIBAN(val), {
      message: "Invalid IBAN checksum or format",
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
      try {
        const body = SepaSchema.parse(request.body);
        const user = (request as any).user;

        // Verify ownership
        if (body.user_id !== user.id) {
          return reply
            .status(403)
            .send({ error: "Unauthorized: User ID mismatch" });
        }

        const { error } = await supabase.from("sepa").insert([body]);

        if (error) {
          throw error;
        }

        return { message: "SEPA info added successfully" };
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          const ibanError = err.issues.find((issue) => issue.path.includes("iban"));
          if (ibanError) {
            return reply
              .status(400)
              .send({ error: "Invalid IBAN. Please check your IBAN and try again." });
          }
          return reply
            .status(400)
            .send({ error: "Validation Error", details: err.issues });
        }
        server.log.error(err);
        return reply
          .status(500)
          .send({ error: err.message || "Internal Server Error" });
      }
    },
  );



  server.get(
    "/sepa/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const user = (request as any).user;

        const { data, error } = await supabase
          .from("sepa")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (error && error.code === "PGRST116") {
          return reply.status(404).send({ error: "Member not found" });
        }
        if (error) {
          throw error;
        }

        return data;
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return reply
            .status(400)
            .send({ error: "Validation Error", details: err.issues });
        }
        server.log.error(err);
        return reply
          .status(500)
          .send({ error: err.message || "Internal Server Error" });
      }
    },
  );

  server.put(
    "/sepa/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const body = SepaSchema.parse(request.body);

        if (user.id !== body.user_id) {
          return reply.status(403).send({
            error:
              "Forbidden: userId in request params doesn't match body's userId",
          });
        }
        const { data, error } = await supabase
          .from("sepa")
          .upsert(body, { onConflict: "user_id" })
          .select()
          .single();

        if (error && error.code === "PGRST116") {
          return reply.status(404).send({ error: "Member not found" });
        }

        return data;
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          const ibanError = err.issues.find((issue) => issue.path.includes("iban"));
          if (ibanError) {
            return reply
              .status(400)
              .send({ error: "Invalid IBAN. Please check your IBAN and try again." });
          }
          return reply
            .status(400)
            .send({ error: "Validation Error", details: err.issues });
        }
        server.log.error(err);
        return reply
          .status(500)
          .send({ error: err.message || "Internal Server Error" });
      }
    },
  );
}
