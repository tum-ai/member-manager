import { createServer } from "node:http";

const PORT = Number(process.env.PARTNER_PORTAL_STUB_PORT ?? 8791);
const TOKEN = "e2e-partner-management-token";
const BRONZE_TIER_ID = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c13";
const SILVER_TIER_ID = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11";
const GOLD_TIER_ID = "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c12";
const tiers = [
	{
		id: BRONZE_TIER_ID,
		slug: "bronze",
		displayName: "Bronze",
		hasCvAccess: false,
		jobQuota: 1,
		eventQuota: {},
		displayOrder: 1,
	},
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
const jobs = [];

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
	const isPartnerMutation =
		url.pathname.startsWith(collectionPath) &&
		["POST", "PATCH", "DELETE"].includes(request.method ?? "");
	if (
		isPartnerMutation &&
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			request.headers["x-member-manager-user-id"] ?? "",
		)
	) {
		return json(response, 400, { error: "invalid_actor" });
	}

	if (url.pathname === collectionPath && request.method === "GET") {
		return json(response, 200, { data: { partners, tiers } });
	}
	if (url.pathname === collectionPath && request.method === "POST") {
		const input = await readJson(request);
		if (
			input.partnerKind === "single_job_buyer" &&
			input.tierId !== BRONZE_TIER_ID
		) {
			return json(response, 400, {
				error: {
					code: "invalid_input",
					message: "Single-job buyers must use the Bronze compatibility tier.",
				},
			});
		}
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
		jobs.splice(0, jobs.length);
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

	const unarchiveMatch = url.pathname.match(
		/^\/api\/internal\/member-manager\/partners\/([^/]+)\/unarchive$/,
	);
	if (unarchiveMatch && request.method === "POST") {
		const partner = partners.find((item) => item.id === unarchiveMatch[1]);
		if (!partner) {
			return json(response, 404, {
				error: { code: "not_found", message: "Partner not found." },
			});
		}
		const today = new Date().toISOString().slice(0, 10);
		partner.status =
			partner.contractEnd < today
				? "expired"
				: partner.acceptedAt
					? "active"
					: "invited";
		partner.updatedAt = new Date().toISOString();
		return json(response, 200, { data: { ok: true } });
	}

	const jobsCollectionMatch = url.pathname.match(
		/^\/api\/internal\/member-manager\/partners\/([^/]+)\/jobs$/,
	);
	if (jobsCollectionMatch && request.method === "GET") {
		return json(response, 200, {
			data: {
				jobs: jobs.filter(
					(job) =>
						job.partnerId === jobsCollectionMatch[1] &&
						job.status !== "archived",
				),
			},
		});
	}
	if (jobsCollectionMatch && request.method === "POST") {
		const input = await readJson(request);
		const partner = partners.find((item) => item.id === jobsCollectionMatch[1]);
		if (
			partner?.partnerKind === "single_job_buyer" &&
			jobs.some(
				(job) =>
					job.partnerId === jobsCollectionMatch[1] && job.status !== "archived",
			)
		) {
			return json(response, 409, {
				error: {
					code: "conflict",
					message: "This account includes one job posting.",
				},
			});
		}
		const now = new Date().toISOString();
		const job = {
			id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c14",
			partnerId: jobsCollectionMatch[1],
			...input,
			contactRole: input.contactRole || null,
			externalUrl: input.externalUrl || null,
			logoUrl: input.logoUrl || null,
			status: "approved",
			submittedAt: now,
			publishedAt: now,
			expiresAt: null,
			createdAt: now,
			updatedAt: now,
		};
		jobs.push(job);
		return json(response, 201, { data: { job } });
	}

	const jobItemMatch = url.pathname.match(
		/^\/api\/internal\/member-manager\/partners\/([^/]+)\/jobs\/([^/]+)$/,
	);
	if (jobItemMatch && request.method === "PATCH") {
		const input = await readJson(request);
		const job = jobs.find(
			(item) =>
				item.partnerId === jobItemMatch[1] && item.id === jobItemMatch[2],
		);
		if (!job) {
			return json(response, 404, {
				error: { code: "not_found", message: "Active job not found." },
			});
		}
		Object.assign(job, input, {
			contactRole: input.contactRole || null,
			externalUrl: input.externalUrl || null,
			logoUrl: input.logoUrl || null,
			updatedAt: new Date().toISOString(),
		});
		return json(response, 200, { data: { job } });
	}
	if (jobItemMatch && request.method === "DELETE") {
		const job = jobs.find(
			(item) =>
				item.partnerId === jobItemMatch[1] && item.id === jobItemMatch[2],
		);
		if (!job) {
			return json(response, 404, {
				error: { code: "not_found", message: "Active job not found." },
			});
		}
		job.status = "archived";
		return json(response, 200, { data: { ok: true } });
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
