import "../setup.js";
import assert from "node:assert";
import {
	after,
	afterEach,
	before,
	beforeEach,
	describe,
	test,
} from "node:test";
import type { DevMcpCatalog } from "@member-manager/shared";
import type { FastifyInstance } from "fastify";
import {
	setDevMcpCatalogClient,
	setDevMcpServiceToken,
} from "../../src/lib/devMcpCatalog.js";
import { ServiceUnavailableError } from "../../src/lib/errors.js";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	resetDatabase,
	testTokens,
	testUserIds,
} from "../helpers.js";
import {
	mockDatabase,
	mockRpcHandlers,
	mockSupabaseErrors,
} from "../mocks/supabase.js";

const SERVICE_TOKEN = "test-dev-mcp-service-token";
const USER_SLACK_ID = "U0USER123";
const ADMIN_SLACK_ID = "U0ADMIN456";
const SLACK_IDS: Record<string, string> = {
	[USER_SLACK_ID]: testUserIds.user,
	[ADMIN_SLACK_ID]: testUserIds.admin,
};

// dev-mcp's WORKFLOW_POLICY as of 2026-11.
const CATALOG: DevMcpCatalog = {
	tools: (
		[
			["whoami", "member", false],
			["create_mailbox", "lead", false],
			["create_shared_mailbox", "admin", false],
			["suspend_mailbox", "admin", true],
			["add_to_github_org", "lead", false],
			["create_notion_page", "member", false],
		] as const
	).map(([name, minRole, destructive]) => ({
		name,
		title: name,
		description: `${name} tool`,
		minRole,
		requestableBy: null,
		destructive,
		maxCallsPerDay: null,
	})),
};

type Row = Record<string, unknown>;
const accessRows = () => mockDatabase.dev_mcp_access;
const findAccess = (userId: string) =>
	accessRows().find((row) => row.user_id === userId);
const grantsOf = (userId: string) =>
	mockDatabase.dev_mcp_tool_grants
		.filter((row) => row.user_id === userId)
		.map((row) => String(row.tool))
		.sort();
const events = () => mockDatabase.dev_mcp_access_events;

function storeAccess(overrides: Row = {}, tools: string[] = []): void {
	const row = {
		user_id: testUserIds.user,
		status: "requested",
		role: null,
		requested_at: "2026-11-09T10:00:00Z",
		decided_at: null,
		decided_by: null,
		decision_note: null,
		last_seen_at: null,
		last_client_id: null,
		last_client_name: null,
		...overrides,
	};
	accessRows().push(row);
	for (const tool of tools) {
		mockDatabase.dev_mcp_tool_grants.push({ user_id: row.user_id, tool });
	}
}

function record(userId: string, slackUserId: string) {
	const access = findAccess(userId);
	const active = access?.status === "active";
	return {
		user_id: userId,
		slack_user_id: slackUserId,
		display_name: "Test User",
		member_status: "active",
		slack_team_ok: true,
		status: access?.status ?? "none",
		role: active ? access?.role : null,
		tools: active ? grantsOf(userId) : [],
	};
}

const hinted = (message: string, hint: string) => ({
	data: null,
	error: { message, hint, code: "P0001" },
});

/** In-memory versions of the migration's SQL functions. */
function installRpcFakes(): void {
	mockRpcHandlers.dev_mcp_access_for = ({ slack_user_id }) => {
		const userId = SLACK_IDS[String(slack_user_id)];
		return {
			data: userId ? record(userId, String(slack_user_id)) : null,
			error: null,
		};
	};

	mockRpcHandlers.dev_mcp_file_request = (params) => {
		const userId = String(params.p_user_id);
		const existing = findAccess(userId);
		if (existing && existing.status !== "denied") {
			return { data: false, error: null };
		}
		if (existing) {
			Object.assign(existing, { status: "requested", role: null });
		} else {
			storeAccess({ user_id: userId });
		}
		events().push({
			user_id: userId,
			source: params.p_source,
			action: "access_requested",
			details: params.p_details,
		});
		return { data: true, error: null };
	};

	mockRpcHandlers.dev_mcp_apply_change = (params) => {
		const userId = String(params.p_user_id);
		const current = findAccess(userId);
		const from = params.p_from_statuses as string[];
		if (!from.includes(String(current?.status ?? "none"))) {
			return current
				? hinted("Can't do that", "dev_mcp_conflict")
				: hinted("No request", "dev_mcp_not_found");
		}
		if (
			params.p_expected_role !== null &&
			current?.role !== params.p_expected_role
		) {
			return hinted("Role changed", "dev_mcp_conflict");
		}
		const staysAdmin =
			params.p_status === "active" && params.p_role === "admin";
		const otherAdmins = accessRows().filter(
			(row) =>
				row.status === "active" &&
				row.role === "admin" &&
				row.user_id !== userId,
		);
		if (
			current?.status === "active" &&
			current.role === "admin" &&
			!staysAdmin &&
			otherAdmins.length === 0
		) {
			return hinted("Last admin", "dev_mcp_last_admin");
		}
		const statusChanged = current?.status !== params.p_status;
		Object.assign(current ?? {}, {
			status: params.p_status,
			role: params.p_role,
			decided_at: "2026-11-09T12:00:00Z",
			decided_by: params.p_actor_id,
			...(statusChanged ? { decision_note: params.p_note } : {}),
		});
		const before = grantsOf(userId);
		const keep = (tool: unknown) => {
			if (params.p_status !== "active") return false;
			const set = params.p_set_tools as string[] | null;
			const drop = params.p_drop_tools as string[] | null;
			return (
				(!set || set.includes(String(tool))) && !drop?.includes(String(tool))
			);
		};
		mockDatabase.dev_mcp_tool_grants = mockDatabase.dev_mcp_tool_grants.filter(
			(row) => row.user_id !== userId || keep(row.tool),
		);
		if (params.p_status === "active") {
			for (const tool of (params.p_set_tools as string[] | null) ?? []) {
				if (!before.includes(tool)) {
					mockDatabase.dev_mcp_tool_grants.push({ user_id: userId, tool });
				}
			}
		}
		const after = grantsOf(userId);
		if (
			statusChanged ||
			current?.role !== params.p_role ||
			before.join() !== after.join()
		) {
			events().push({
				user_id: userId,
				actor_id: params.p_actor_id,
				source: params.p_source,
				action: params.p_action,
				details: { before, after },
			});
		}
		return { data: null, error: null };
	};
}

describe("dev-mcp access routes", () => {
	let app: FastifyInstance;
	let catalogFails = false;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		setDevMcpCatalogClient(undefined);
		setDevMcpServiceToken(undefined);
		await closeTestApp();
	});

	beforeEach(() => {
		resetDatabase();
		installRpcFakes();
		catalogFails = false;
		setDevMcpServiceToken(SERVICE_TOKEN);
		setDevMcpCatalogClient({
			getCatalog: async () => {
				if (catalogFails) {
					throw new ServiceUnavailableError(
						"Dev MCP can't be reached right now; try again shortly",
					);
				}
				return CATALOG;
			},
		});
	});

	afterEach(() => {
		delete mockSupabaseErrors.tables.dev_mcp_access;
	});

	const change = (body: unknown, token = testTokens.admin) =>
		app.inject({
			method: "PATCH",
			url: `/api/admin/dev-mcp-access/${testUserIds.user}`,
			headers: authHeaders(token),
			payload: body as Record<string, unknown>,
		});

	describe("GET /api/admin/dev-mcp-access", () => {
		const list = (token?: string) =>
			app.inject({
				method: "GET",
				url: "/api/admin/dev-mcp-access",
				headers: token ? authHeaders(token) : {},
			});

		test("lists requests with the member, the grants and the deciding admin", async () => {
			storeAccess(
				{
					status: "active",
					role: "lead",
					decided_at: "2026-11-09T11:00:00Z",
					decided_by: testUserIds.admin,
				},
				["whoami", "create_mailbox"],
			);

			const response = await list(testTokens.admin);

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload), [
				{
					user_id: testUserIds.user,
					name: "Test User",
					department: "Software Development",
					member_status: "active",
					status: "active",
					role: "lead",
					tools: ["create_mailbox", "whoami"],
					requested_at: "2026-11-09T10:00:00Z",
					decided_at: "2026-11-09T11:00:00Z",
					decided_by: testUserIds.admin,
					decided_by_name: "Admin User",
					decision_note: null,
					last_seen_at: null,
					last_client_id: null,
					last_client_name: null,
				},
			]);
		});

		test("shows no tools for someone who isn't active", async () => {
			storeAccess({ status: "suspended" }, ["whoami"]);

			const [entry] = JSON.parse((await list(testTokens.admin)).payload);

			assert.deepStrictEqual(entry.tools, []);
			assert.strictEqual(entry.role, null);
		});

		test("is for admins only", async () => {
			assert.strictEqual((await list()).statusCode, 401);
			assert.strictEqual((await list(testTokens.user)).statusCode, 403);
		});

		test("reports a database failure", async () => {
			mockSupabaseErrors.tables.dev_mcp_access = { message: "boom" };
			assert.strictEqual((await list(testTokens.admin)).statusCode, 500);
		});
	});

	describe("GET /api/admin/dev-mcp-access/catalog", () => {
		const catalog = (token = testTokens.admin) =>
			app.inject({
				method: "GET",
				url: "/api/admin/dev-mcp-access/catalog",
				headers: authHeaders(token),
			});

		test("returns dev-mcp's catalog to admins", async () => {
			const response = await catalog();
			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload), CATALOG);
			assert.strictEqual((await catalog(testTokens.user)).statusCode, 403);
		});

		test("says when dev-mcp can't be reached", async () => {
			catalogFails = true;
			const response = await catalog();
			assert.strictEqual(response.statusCode, 503);
			assert.match(JSON.parse(response.payload).error, /can't be reached/);
		});
	});

	describe("PATCH /api/admin/dev-mcp-access/:userId", () => {
		test("approving grants the role's preset and records the event", async () => {
			storeAccess();

			const response = await change({ action: "approve", role: "lead" });

			assert.strictEqual(response.statusCode, 200);
			const entry = JSON.parse(response.payload);
			assert.strictEqual(entry.status, "active");
			assert.strictEqual(entry.role, "lead");
			assert.deepStrictEqual(entry.tools, [
				"add_to_github_org",
				"create_mailbox",
				"create_notion_page",
				"whoami",
			]);
			assert.strictEqual(entry.decided_by, testUserIds.admin);
			assert.deepStrictEqual(
				events().map((event) => [event.action, event.source, event.actor_id]),
				[["member_approved", "admin", testUserIds.admin]],
			);
		});

		test("an admin preset leaves out destructive tools", async () => {
			storeAccess();

			const entry = JSON.parse(
				(await change({ action: "approve", role: "admin" })).payload,
			);

			assert.ok(entry.tools.includes("create_shared_mailbox"));
			assert.ok(!entry.tools.includes("suspend_mailbox"));
		});

		test("a demotion drops the grants the new role doesn't allow", async () => {
			storeAccess({ status: "active", role: "admin" }, [
				"whoami",
				"create_mailbox",
				"suspend_mailbox",
				"retired_tool",
			]);
			storeAccess({
				user_id: testUserIds.admin,
				status: "active",
				role: "admin",
			});

			const response = await change({ action: "set_role", role: "member" });

			assert.strictEqual(response.statusCode, 200);
			// Tools dev-mcp no longer lists are left alone, as dev-mcp does.
			assert.deepStrictEqual(grantsOf(testUserIds.user), [
				"retired_tool",
				"whoami",
			]);
			assert.strictEqual(findAccess(testUserIds.user)?.role, "member");
		});

		test("a promotion keeps the grants as they are", async () => {
			storeAccess({ status: "active", role: "member" }, ["whoami"]);

			await change({ action: "set_role", role: "lead" });

			assert.deepStrictEqual(grantsOf(testUserIds.user), ["whoami"]);
		});

		test("sets exactly the tools asked for, destructive ones included", async () => {
			storeAccess({ status: "active", role: "admin" }, ["whoami"]);

			const response = await change({
				action: "set_tools",
				tools: ["suspend_mailbox", "create_notion_page", "suspend_mailbox"],
			});

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(response.payload).tools, [
				"create_notion_page",
				"suspend_mailbox",
			]);
		});

		test("rejects unknown tools and tools above the role", async () => {
			storeAccess({ status: "active", role: "member" }, ["whoami"]);

			const unknown = await change({ action: "set_tools", tools: ["rm_rf"] });
			assert.strictEqual(unknown.statusCode, 400);
			assert.match(JSON.parse(unknown.payload).error, /Unknown tools: rm_rf/);

			const tooHigh = await change({
				action: "set_tools",
				tools: ["whoami", "create_mailbox"],
			});
			assert.strictEqual(tooHigh.statusCode, 400);
			assert.match(
				JSON.parse(tooHigh.payload).error,
				/create_mailbox need a higher role than member/,
			);
			assert.deepStrictEqual(grantsOf(testUserIds.user), ["whoami"]);
			assert.strictEqual(events().length, 0);
		});

		test("suspends with a note and drops the grants; re-approving restores a preset", async () => {
			storeAccess({ status: "active", role: "lead" }, ["whoami"]);

			const suspended = await change({ action: "suspend", note: " Left " });
			assert.strictEqual(suspended.statusCode, 200);
			assert.deepStrictEqual(
				{
					status: findAccess(testUserIds.user)?.status,
					role: findAccess(testUserIds.user)?.role,
					note: findAccess(testUserIds.user)?.decision_note,
				},
				{ status: "suspended", role: null, note: "Left" },
			);
			assert.deepStrictEqual(grantsOf(testUserIds.user), []);

			const back = await change({ action: "reapprove", role: "member" });
			assert.strictEqual(back.statusCode, 200);
			assert.deepStrictEqual(JSON.parse(back.payload).tools, [
				"create_notion_page",
				"whoami",
			]);
			assert.strictEqual(findAccess(testUserIds.user)?.decision_note, null);
		});

		test("denies a request", async () => {
			storeAccess();

			const response = await change({ action: "deny", note: "Not yet" });

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(findAccess(testUserIds.user)?.status, "denied");
		});

		test("refuses an action that doesn't fit the current status", async () => {
			for (const [status, body] of [
				["requested", { action: "set_role", role: "lead" }],
				["requested", { action: "suspend" }],
				["requested", { action: "reapprove", role: "lead" }],
				["active", { action: "approve", role: "lead" }],
				["active", { action: "deny" }],
				["denied", { action: "approve", role: "lead" }],
				["suspended", { action: "set_tools", tools: [] }],
			] as const) {
				resetDatabase();
				installRpcFakes();
				storeAccess({
					status,
					role: status === "active" ? "member" : null,
				});
				const response = await change(body);
				assert.strictEqual(
					response.statusCode,
					409,
					`${status} ${body.action}`,
				);
				assert.strictEqual(findAccess(testUserIds.user)?.status, status);
			}
		});

		test("nobody removes the last active admin", async () => {
			storeAccess({ status: "active", role: "admin" }, ["whoami"]);

			for (const body of [
				{ action: "suspend" },
				{ action: "set_role", role: "lead" },
			]) {
				const response = await change(body);
				assert.strictEqual(response.statusCode, 409, body.action);
				assert.match(JSON.parse(response.payload).error, /Last admin/);
			}
			assert.strictEqual(findAccess(testUserIds.user)?.role, "admin");
		});

		test("needs dev-mcp's catalog to approve, not to suspend", async () => {
			catalogFails = true;
			storeAccess();
			assert.strictEqual(
				(await change({ action: "approve", role: "member" })).statusCode,
				503,
			);
			assert.strictEqual(findAccess(testUserIds.user)?.status, "requested");

			assert.strictEqual((await change({ action: "deny" })).statusCode, 200);
		});

		test("rejects an invalid action", async () => {
			storeAccess();
			for (const body of [
				{ action: "approve" },
				{ action: "approve", role: "editor" },
				{ action: "delete" },
				{ action: "set_tools", tools: ["Bad Name"] },
				{ action: "deny", note: "x".repeat(501) },
			]) {
				assert.strictEqual((await change(body)).statusCode, 400);
			}
		});

		test("404s for a member without a request", async () => {
			const response = await change({ action: "approve", role: "member" });
			assert.strictEqual(response.statusCode, 404);
		});

		test("is for admins only", async () => {
			storeAccess();
			const response = await change(
				{ action: "approve", role: "admin" },
				testTokens.user,
			);
			assert.strictEqual(response.statusCode, 403);
			assert.strictEqual(findAccess(testUserIds.user)?.status, "requested");
		});
	});

	describe("GET /api/dev-mcp-access/me", () => {
		const me = (token: string) =>
			app.inject({
				method: "GET",
				url: "/api/dev-mcp-access/me",
				headers: authHeaders(token),
			});

		test("says when the member hasn't asked yet", async () => {
			assert.deepStrictEqual(JSON.parse((await me(testTokens.user)).payload), {
				status: "none",
				role: null,
				tools: [],
			});
		});

		test("returns the member's own status, role and tools only", async () => {
			storeAccess(
				{ status: "active", role: "lead", decision_note: "admin only" },
				["whoami"],
			);
			storeAccess({ user_id: testUserIds.admin, status: "denied" });

			assert.deepStrictEqual(JSON.parse((await me(testTokens.user)).payload), {
				status: "active",
				role: "lead",
				tools: ["whoami"],
			});
			assert.deepStrictEqual(JSON.parse((await me(testTokens.admin)).payload), {
				status: "denied",
				role: null,
				tools: [],
			});
		});
	});

	describe("service API for dev-mcp", () => {
		const service = (
			method: "GET" | "POST",
			path: string,
			token: string | null = SERVICE_TOKEN,
			payload?: Record<string, unknown>,
		) =>
			app.inject({
				method,
				url: `/api/internal/dev-mcp/access/${path}`,
				headers: token ? { authorization: `Bearer ${token}` } : {},
				...(payload ? { payload } : {}),
			});

		test("refuses requests without the service token", async () => {
			for (const token of [null, "wrong-token", testTokens.admin]) {
				const response = await service("GET", USER_SLACK_ID, token);
				assert.strictEqual(response.statusCode, 401, String(token));
				assert.deepStrictEqual(JSON.parse(response.payload), {
					error: "unauthorized",
				});
			}
		});

		test("refuses everything while the token isn't configured", async () => {
			setDevMcpServiceToken(null);
			assert.strictEqual((await service("GET", USER_SLACK_ID)).statusCode, 401);
		});

		test("returns the access record by Slack ID", async () => {
			storeAccess({ status: "active", role: "member" }, ["whoami"]);

			const response = await service("GET", USER_SLACK_ID);

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(response.headers["cache-control"], "no-store");
			assert.deepStrictEqual(JSON.parse(response.payload), {
				access: {
					user_id: testUserIds.user,
					slack_user_id: USER_SLACK_ID,
					display_name: "Test User",
					member_status: "active",
					slack_team_ok: true,
					status: "active",
					role: "member",
					tools: ["whoami"],
				},
			});
		});

		test("says none for a member without a request", async () => {
			const { access } = JSON.parse(
				(await service("GET", USER_SLACK_ID)).payload,
			);
			assert.strictEqual(access.status, "none");
		});

		test("404s for a Slack ID no account has", async () => {
			for (const id of ["U0NOBODY1", "not-a-slack-id"]) {
				const response = await service("GET", id);
				assert.strictEqual(response.statusCode, 404, id);
				assert.deepStrictEqual(JSON.parse(response.payload), {
					error: "not_found",
				});
			}
			const request = await service("POST", "U0NOBODY1/request");
			assert.strictEqual(request.statusCode, 404);
		});

		test("files a request once, and reopens a denied one", async () => {
			const first = await service(
				"POST",
				`${USER_SLACK_ID}/request`,
				undefined,
				{
					display_name: "Test U.",
				},
			);
			assert.strictEqual(first.statusCode, 201);
			const body = JSON.parse(first.payload);
			assert.strictEqual(body.created, true);
			assert.strictEqual(body.access.status, "requested");
			assert.deepStrictEqual(events()[0], {
				user_id: testUserIds.user,
				source: "dev_mcp",
				action: "access_requested",
				details: { slack_user_id: USER_SLACK_ID, display_name: "Test U." },
			});

			const again = await service("POST", `${USER_SLACK_ID}/request`);
			assert.strictEqual(again.statusCode, 200);
			assert.strictEqual(JSON.parse(again.payload).created, false);

			const row = findAccess(testUserIds.user);
			assert.ok(row);
			row.status = "denied";
			const reopened = await service("POST", `${USER_SLACK_ID}/request`);
			assert.strictEqual(reopened.statusCode, 201);
			assert.strictEqual(findAccess(testUserIds.user)?.status, "requested");
		});

		test("leaves active and suspended members as they are", async () => {
			storeAccess({ status: "suspended" });

			const response = await service("POST", `${USER_SLACK_ID}/request`);

			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(
				JSON.parse(response.payload).access.status,
				"suspended",
			);
		});

		test("rejects an invalid request body", async () => {
			const response = await service(
				"POST",
				`${USER_SLACK_ID}/request`,
				undefined,
				{ display_name: "x".repeat(201) },
			);
			assert.strictEqual(response.statusCode, 400);
		});

		test("reports a failing lookup as a server error", async () => {
			mockSupabaseErrors.rpc.dev_mcp_access_for = { message: "boom" };
			assert.strictEqual((await service("GET", USER_SLACK_ID)).statusCode, 500);
		});
	});
});
