import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const MemberSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  given_name: z.string().optional().default(""),
  surname: z.string().optional().default(""),
  date_of_birth: z.string().optional().default("1900-01-01"),
  street: z.string().optional().default(""),
  number: z.string().optional().default(""),
  postal_code: z.string().optional().default(""),
  city: z.string().optional().default(""),
  country: z.string().optional().default(""),
  active: z.boolean().optional().default(true),
  salutation: z.string().optional().default(""),
  role: z.string().optional().default("user"),
});

export async function memberRoutes(server: FastifyInstance) {
  server.post(
    "/members",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const body = MemberSchema.parse(request.body);
        const user = (request as any).user;

        if (body.user_id !== user.id) {
          return reply
            .status(403)
            .send({ error: "Unauthorized: User ID mismatch" });
        }

        // Check if member exists
        const { data: existingMember, error: fetchError } = await supabase
          .from("members")
          .select("user_id")
          .eq("user_id", body.user_id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

        if (existingMember) {
          // If exists, just return the role/member
          const { data: memberData, error: roleError } = await supabase
            .from("members")
            .select("*")
            .eq("user_id", body.user_id)
            .single();

          if (roleError) throw roleError;
          return memberData;
        }

        // Insert new member
        const { data, error } = await supabase
          .from("members")
          .insert(body)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      } catch (err: any) {
        server.log.error(err);
        return reply
          .status(500)
          .send({ error: err.message || "Internal Server Error" });
      }
    },
  );

  server.get(
    "/members",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { data, error } = await supabase.from("members").select("*");
      if (error) {
        server.log.error(error);
        return reply.status(500).send({ error: error.message });
      }
      return data;
    },
  );

  server.get(
    "/members/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const user = (request as any).user;

        const { data, error } = await supabase
          .from("members")
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
    "/members/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const body = MemberSchema.parse(request.body);
        const user = (request as any).user;

        if (user.id !== body.user_id) {
          return reply.status(403).send({
            error:
              "Forbidden: userId in request params doesn't match body's userId",
          });
        }
        const { data, error } = await supabase
          .from("members")
          .upsert(body, { onConflict: "user_id" })
          .select()
          .single();

        if (error && error.code === "PGRST116") {
          return reply.status(404).send({ error: "Member not found" });
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
}
