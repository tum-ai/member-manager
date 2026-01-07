import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { memberRoutes } from './routes/members.js';
import { sepaRoutes } from './routes/sepa.js';

dotenv.config();

const server = Fastify({
  logger: true
});

server.register(cors, {
  origin: true // Allow all for dev, tighten for prod
});

server.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

server.register(memberRoutes, { prefix: '/api' });
server.register(sepaRoutes, { prefix: '/api' });

const start = async () => {
  try {
    const PORT = parseInt(process.env.PORT || '3000');
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();