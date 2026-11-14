import { createServer } from "node:http";

// Local stand-in for dev-mcp's `GET /service/catalog` (the tool catalog the
// Dev tab of /admin/mcp-access needs), started by playwright.config.ts. The
// tools mirror dev-mcp's WORKFLOW_POLICY as of 2026-11.

const PORT = Number(process.env.DEV_MCP_STUB_PORT ?? 8792);
const TOKEN = "e2e-dev-mcp-service-token";

const tool = (name, title, minRole, extra = {}) => ({
	name,
	title,
	description: `${title}.`,
	minRole,
	requestableBy: null,
	destructive: false,
	maxCallsPerDay: null,
	...extra,
});

const catalog = {
	tools: [
		tool("whoami", "Who am I", "member"),
		tool("create_mailbox", "Create a mailbox", "lead", {
			requestableBy: "member",
			maxCallsPerDay: 10,
		}),
		tool("create_shared_mailbox", "Create a shared mailbox", "admin", {
			requestableBy: "member",
			maxCallsPerDay: 5,
		}),
		tool("suspend_mailbox", "Suspend a mailbox", "admin", {
			requestableBy: "lead",
			destructive: true,
			maxCallsPerDay: 10,
		}),
		tool("add_to_github_org", "Invite to GitHub", "lead", {
			requestableBy: "member",
			maxCallsPerDay: 20,
		}),
		tool("create_notion_page", "Create a Notion page", "member", {
			maxCallsPerDay: 50,
		}),
	],
};

function json(response, status, body) {
	response.writeHead(status, {
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
	const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
	if (request.method === "GET" && url.pathname === "/health") {
		return json(response, 200, { ok: true });
	}
	if (request.method === "GET" && url.pathname === "/service/catalog") {
		if (request.headers.authorization !== `Bearer ${TOKEN}`) {
			return json(response, 401, { error: "unauthorized" });
		}
		return json(response, 200, catalog);
	}
	return json(response, 404, { error: "not_found" });
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`dev-mcp stub listening on http://127.0.0.1:${PORT}`);
});
