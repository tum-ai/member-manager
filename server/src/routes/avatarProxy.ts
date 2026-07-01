import type { FastifyInstance } from "fastify";
import { isUrlAllowed } from "../lib/ssrfGuard.js";

// Slack/Gravatar avatar CDNs don't send CORS headers, so the browser can't read
// them onto a canvas (org-tree PNG export) and logs cross-origin warnings. We
// proxy them through our own origin instead. Strictly allowlisted to avatar
// hosts so this can't be abused as an open proxy / SSRF vector.
const ALLOWED_AVATAR_HOSTS = [
	"avatars.slack-edge.com",
	"a.slack-edge.com",
	"secure.gravatar.com",
];

const AVATAR_CACHE_SECONDS = 60 * 60 * 24; // 24h

export async function avatarProxyRoutes(
	server: FastifyInstance,
): Promise<void> {
	server.get<{ Querystring: { url?: string } }>(
		"/avatars",
		// Rendered via <img src>, which can't carry an auth header — must stay
		// unauthenticated. The host allowlist is the safety boundary.
		{ config: { rateLimit: false } },
		async (request, reply) => {
			const raw = request.query.url;
			if (!raw) {
				return reply.code(400).send({ error: "Missing url" });
			}

			let target: URL;
			try {
				target = new URL(raw);
			} catch {
				return reply.code(400).send({ error: "Invalid url" });
			}

			// SSRF boundary: only fetch from the avatar-host allowlist (https only).
			if (!isUrlAllowed(target, { allowedHosts: ALLOWED_AVATAR_HOSTS })) {
				return reply.code(400).send({ error: "Host not allowed" });
			}

			let upstream: Response;
			try {
				upstream = await fetch(target.toString(), {
					redirect: "follow",
					headers: { Accept: "image/*" },
				});
			} catch (error) {
				request.log.warn({ err: error }, "Avatar proxy fetch failed");
				return reply.code(502).send({ error: "Upstream fetch failed" });
			}

			const contentType = upstream.headers.get("content-type") ?? "";
			if (!upstream.ok || !contentType.startsWith("image/")) {
				return reply.code(upstream.status === 404 ? 404 : 502).send();
			}

			const body = Buffer.from(await upstream.arrayBuffer());
			return (
				reply
					.header("Content-Type", contentType)
					.header("Cache-Control", `public, max-age=${AVATAR_CACHE_SECONDS}`)
					// Same-origin in production, but be explicit so the image is always
					// readable cross-origin (and onto an export canvas).
					.header("Access-Control-Allow-Origin", "*")
					.header("Cross-Origin-Resource-Policy", "cross-origin")
					.send(body)
			);
		},
	);
}
