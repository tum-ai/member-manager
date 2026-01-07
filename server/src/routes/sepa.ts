import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';

const SepaSchema = z.object({
  member_id: z.string(),
  iban: z.string(),
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
        server.log.error(err);
        return reply.status(500).send({ error: err.message || "Internal Server Error" });
    }
  });
}
