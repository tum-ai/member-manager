import { createServer } from "node:http";

const PORT = 8791;
const TOKEN = "e2e-partner-management-token";
const SILVER_TIER_ID = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11";
const GOLD_TIER_ID = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c12";
const tiers = [
	{
		id: SILVER_TIER_ID,
		slug: "silver",
		displayName: "Silver",
		hasCvAccess: true,
		jobQuota: 2,
		eventQuota: {},
		displayOrder: 2,
	},
	{
		id: GOLD_TIER_ID,
		slug: "gold",
		displayName: "Gold",
		hasCvAccess: true,
		jobQuota: 4,
		eventQuota: {},
		displayOrder: 3,
	},
];
const partners = [];

function json(response, status, body) {
	response.writeHead(status, {
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	response.end(JSON.stringify(body));
}

async function readJson(request) {
	const chunks = [];
	for await (const chunk of request) chunks.push(chunk);
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function tierFor(id) {
	const tier = tiers.find((item) => item.id === id);
	if (!tier) return null;
	const { displayOrder: _displayOrder, ...nested } = tier;
	return nested;
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
	if (url.pathname === "/health") {
		return json(response, 200, { status: "ok" });
	}
	if (request.headers.authorization !== `Bearer ${TOKEN}`) {
		return json(response, 401, { error: "unauthorized" });
	}

	const collectionPath = "/api/internal/member-manager/partners";
	if (url.pathname === collectionPath && request.method === "GET") {
		return json(response, 200, { data: { partners, tiers } });
	}
	if (url.pathname === collectionPath && request.method === "POST") {
		const input = await readJson(request);
		const now = new Date().toISOString();
		const partner = {
			id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
			companyName: input.companyName,
			primaryEmail: input.primaryEmail,
			status: "invited",
			partnerKind: input.partnerKind,
			tierId: input.tierId,
			tier: tierFor(input.tierId),
			contractStart: input.contractStart,
			contractEnd: input.contractEnd,
			websiteUrl: input.websiteUrl || null,
			notes: input.notes || null,
			invitedAt: now,
			acceptedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		partners.splice(0, partners.length, partner);
		return json(response, 201, {
			data: {
				partnerId: partner.id,
				activationLink: "https://partners.example.test/activate/e2e",
				activationEmailSent: true,
			},
		});
	}

	const activationMatch = url.pathname.match(
		/^\/api\/internal\/member-manager\/partners\/([^/]+)\/activation-link$/,
	);
	if (activationMatch && request.method === "POST") {
		return json(response, 200, {
			data: {
				inviteLink: "https://partners.example.test/activate/e2e-new",
				activationEmailSent: true,
			},
		});
	}

	const itemMatch = url.pathname.match(
		/^\/api\/internal\/member-manager\/partners\/([^/]+)$/,
	);
	if (itemMatch && request.method === "PATCH") {
		const input = await readJson(request);
		const partner = partners.find((item) => item.id === itemMatch[1]);
		if (!partner) {
			return json(response, 404, {
				error: { code: "not_found", message: "Partner not found." },
			});
		}
		Object.assign(partner, input, {
			tier: tierFor(input.tierId),
			websiteUrl: input.websiteUrl || null,
			notes: input.notes || null,
			updatedAt: new Date().toISOString(),
		});
		return json(response, 200, { data: { ok: true } });
	}
	if (itemMatch && request.method === "DELETE") {
		const partner = partners.find((item) => item.id === itemMatch[1]);
		if (!partner) {
			return json(response, 404, {
				error: { code: "not_found", message: "Partner not found." },
			});
		}
		partner.status = "archived";
		partner.updatedAt = new Date().toISOString();
		return json(response, 200, { data: { ok: true } });
	}

	return json(response, 404, { error: "not_found" });
});

server.listen(PORT, "127.0.0.1");

function shutdown() {
	server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
