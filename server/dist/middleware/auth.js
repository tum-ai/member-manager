import { supabase } from '../lib/supabase.js';
export async function authenticate(request, reply) {
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
    request.user = user;
}
