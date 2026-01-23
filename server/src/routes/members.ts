import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ForbiddenError, NotFoundError, isNotFoundError } from "../lib/errors.js";
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
      const body = MemberSchema.parse(request.body);
      const user = (request as any).user;

      if (body.user_id !== user.id) {
        throw new ForbiddenError("User ID mismatch");
      }

      // Check if member exists
      const { data: existingMember, error: fetchError } = await supabase
        .from("members")
        .select("user_id")
        .eq("user_id", body.user_id)
        .single();

      if (fetchError && !isNotFoundError(fetchError)) {
        throw fetchError;
      }

      if (existingMember) {
        // If exists, just return the member
        const { data: memberData, error: roleError } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", body.user_id)
          .single();

        if (roleError) throw roleError;
        return memberData;
      }

      // Insert new member (remove role field as it doesn't exist in DB)
      const { role, ...memberData } = body as any;
      const { data, error } = await supabase
        .from("members")
        .insert(memberData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
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
      const user = (request as any).user;

      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (isNotFoundError(error)) {
        throw new NotFoundError("Member not found");
      }
      if (error) {
        throw error;
      }

      return data;
    },
  );

  server.put(
    "/members/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = MemberSchema.parse(request.body);
      const user = (request as any).user;

      if (user.id !== body.user_id) {
        throw new ForbiddenError("User ID mismatch");
      }

      // Remove the 'role' field before upserting since it doesn't exist in the DB
      const { role, ...memberData } = body as any;

      const { data, error } = await supabase
        .from("members")
        .upsert(memberData, { onConflict: "user_id" })
        .select()
        .single();

      if (isNotFoundError(error)) {
        throw new NotFoundError("Member not found");
      }
      if (error) {
        throw error;
      }

      return data;
    },
  );
}
