import type { User } from "@supabase/supabase-js";
import type { FastifyRequest } from "fastify";

export interface AuthenticatedRequest extends FastifyRequest {
	user: User;
}
