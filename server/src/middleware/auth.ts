import { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../lib/supabase.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({ error: 'Missing Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Attach user to request
    (request as any).user = user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;

    const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (roleError || roleData?.role !== "admin") {
        return reply.status(403).send({ error: "Unauthorized: Admin access required" });
    }
}
