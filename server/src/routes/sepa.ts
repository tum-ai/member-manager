import { FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { electronicFormatIBAN, isValidIBAN } from 'ibantools';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';

const SepaSchema = z.object({
  member_id: z.string(),
  iban: z.string()
    .transform((val) => electronicFormatIBAN(val))
    .refine((val): val is string => !!val && isValidIBAN(val), {
      message: "Invalid IBAN checksum or format",
    }),
  bic: z.string(),
  mandate_agreed: z.boolean(),
});

export async function sepaRoutes(server: FastifyInstance) {
  server.post('/sepa', { preHandler: authenticate }, async (request, reply) => {
    try {
        const body = SepaSchema.parse(request.body);

        const { error } = await supabase.from("sepa_mandates").insert([body]);

        if (error) {
            throw error;
        }

        return { message: "SEPA info added successfully" };
    } catch (err: any) {
        if (err instanceof ZodError) {
            return reply.status(400).send({ error: "Validation Error", details: err.issues });
        }
        server.log.error(err);
        return reply.status(500).send({ error: err.message || "Internal Server Error" });
    }
  });
}
