import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DEV_MCP_CATALOG,
	devMcpAccessEntry,
} from "@/test/devMcpAccessFixtures";
import { mcpAccessEntry } from "@/test/mcpAccessFixtures";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import AdminMcpAccessPage from "./AdminMcpAccessPage";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const pending = mcpAccessEntry({ user_id: "u-pending", name: "Pat Pending" });
const approved = mcpAccessEntry({
	user_id: "u-approved",
	name: "Abe Approved",
	status: "approved",
	role: "editor",
});

const devRequested = devMcpAccessEntry({
	user_id: "d-requested",
	name: "Rey Requested",
});
const devActive = devMcpAccessEntry({
	user_id: "d-active",
	name: "Alma Active",
	status: "active",
	role: "admin",
	tools: ["whoami", "suspend_mailbox"],
	decided_at: "2026-11-09T11:00:00Z",
});

function renderPage(path = "/admin/mcp-access") {
	return renderWithClient(
		<MemoryRouter initialEntries={[path]}>
			<AdminMcpAccessPage />
		</MemoryRouter>,
	);
}

function serve(entries = [pending, approved]) {
	const patches: Array<{ userId: string; body: unknown }> = [];
	server.use(
		http.get("/api/admin/mcp-access", () => HttpResponse.json(entries)),
		http.patch("/api/admin/mcp-access/:userId", async ({ params, request }) => {
			patches.push({
				userId: String(params.userId),
				body: await request.json(),
			});
			return HttpResponse.json(pending);
		}),
	);
	return patches;
}

function serveDev({ catalogFails = false } = {}) {
	const patches: Array<{ userId: string; body: unknown }> = [];
	server.use(
		http.get("/api/admin/dev-mcp-access", () =>
			HttpResponse.json([devRequested, devActive]),
		),
		http.get("/api/admin/dev-mcp-access/catalog", () =>
			catalogFails
				? HttpResponse.json(
						{ error: "Dev MCP can't be reached right now" },
						{ status: 503 },
					)
				: HttpResponse.json({ tools: DEV_MCP_CATALOG }),
		),
		http.patch(
			"/api/admin/dev-mcp-access/:userId",
			async ({ params, request }) => {
				patches.push({
					userId: String(params.userId),
					body: await request.json(),
				});
				return HttpResponse.json(devActive);
			},
		),
	);
	return patches;
}

beforeEach(() => {
	showToast.mockReset();
});

describe("AdminMcpAccessPage, Notion tab", () => {
	it("lists pending requests first, then approved, then declined", async () => {
		serve();
		renderPage();

		expect(
			await screen.findByRole("heading", { name: "Waiting for approval (1)" }),
		).toBeVisible();
		const headings = screen
			.getAllByRole("heading", { level: 2 })
			.map((heading) => heading.textContent);
		expect(headings).toEqual([
			"Waiting for approval (1)",
			"Approved (1)",
			"Declined (0)",
		]);
		expect(
			within(
				screen.getByRole("region", { name: "Waiting for approval" }),
			).getByText("Pat Pending"),
		).toBeVisible();
		expect(screen.getByText("Nobody was declined.")).toBeVisible();
	});

	it("approves a request with the picked role", async () => {
		const patches = serve();
		renderPage();

		const pendingSection = await screen.findByRole("region", {
			name: "Waiting for approval",
		});
		await userEvent.click(
			within(pendingSection).getByRole("radio", { name: "Reader" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Approve Pat Pending as reader" }),
		);

		await waitFor(() =>
			expect(patches).toEqual([
				{ userId: "u-pending", body: { action: "approve", role: "reader" } },
			]),
		);
	});

	it("revokes only after the admin confirms", async () => {
		const patches = serve();
		renderPage();

		await userEvent.click(
			await screen.findByRole("button", {
				name: "Revoke Notion MCP access for Abe Approved",
			}),
		);
		const dialog = screen.getByRole("dialog", {
			name: "Revoke Abe Approved's Notion MCP access?",
		});
		expect(patches).toHaveLength(0);
		await userEvent.type(
			within(dialog).getByLabelText("Note for admins (optional)"),
			"Left TUM.ai",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Revoke" }),
		);

		await waitFor(() =>
			expect(patches).toEqual([
				{
					userId: "u-approved",
					body: { action: "revoke", note: "Left TUM.ai" },
				},
			]),
		);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows an error when the list can't be loaded", async () => {
		server.use(
			http.get("/api/admin/mcp-access", () =>
				HttpResponse.json({ error: "Database down" }, { status: 500 }),
			),
		);
		renderPage();

		expect(await screen.findByText("Unable to load requests")).toBeVisible();
		expect(screen.getByText("Database down")).toBeVisible();
	});
});

describe("AdminMcpAccessPage, Dev tab", () => {
	it("opens from ?tab=dev and groups dev-mcp access by status", async () => {
		serve();
		serveDev();
		renderPage("/admin/mcp-access?tab=dev");

		expect(screen.getByRole("tab", { name: "Dev" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(
			await screen.findByRole("heading", { name: "Active (1)" }),
		).toBeVisible();
		expect(
			screen
				.getAllByRole("heading", { level: 2 })
				.map((heading) => heading.textContent),
		).toEqual([
			"Waiting for approval (1)",
			"Active (1)",
			"Suspended (0)",
			"Declined (0)",
		]);
		const tools = await screen.findByRole("list", {
			name: "Dev MCP tools of Alma Active",
		});
		await waitFor(() =>
			expect(
				within(tools).getByText("suspend_mailbox (destructive)"),
			).toBeVisible(),
		);
	});

	it("switches tabs from the Notion tab", async () => {
		serve();
		serveDev();
		renderPage();

		await userEvent.click(screen.getByRole("tab", { name: "Dev" }));

		expect(
			await screen.findByRole("button", {
				name: "Approve Rey Requested for Dev MCP as member",
			}),
		).toBeVisible();
	});

	it("approves with the picked role", async () => {
		serve();
		const patches = serveDev();
		renderPage("/admin/mcp-access?tab=dev");

		const waiting = await screen.findByRole("region", {
			name: "Waiting for approval",
		});
		await userEvent.click(within(waiting).getByRole("radio", { name: "Lead" }));
		await userEvent.click(
			within(waiting).getByRole("button", {
				name: "Approve Rey Requested for Dev MCP as lead",
			}),
		);

		await waitFor(() =>
			expect(patches).toEqual([
				{ userId: "d-requested", body: { action: "approve", role: "lead" } },
			]),
		);
	});

	it("edits tools, offering only what the role allows", async () => {
		serve();
		const patches = serveDev();
		renderPage("/admin/mcp-access?tab=dev");

		await userEvent.click(
			await screen.findByRole("button", {
				name: "Edit Dev MCP tools for Alma Active",
			}),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Dev MCP tools for Alma Active",
		});
		await waitFor(() =>
			expect(within(dialog).getAllByRole("checkbox")).toHaveLength(6),
		);
		await userEvent.click(within(dialog).getByLabelText(/Suspend a mailbox/));
		await userEvent.click(
			within(dialog).getByLabelText("Create a Notion page"),
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Save tools" }),
		);

		await waitFor(() =>
			expect(patches).toEqual([
				{
					userId: "d-active",
					body: {
						action: "set_tools",
						tools: ["create_notion_page", "whoami"],
					},
				},
			]),
		);
	});

	it("suspends only after the admin confirms", async () => {
		serve();
		const patches = serveDev();
		renderPage("/admin/mcp-access?tab=dev");

		await userEvent.click(
			await screen.findByRole("button", {
				name: "Suspend Dev MCP access for Alma Active",
			}),
		);
		const dialog = screen.getByRole("dialog", {
			name: "Suspend Alma Active's Dev MCP access?",
		});
		expect(patches).toHaveLength(0);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Suspend" }),
		);

		await waitFor(() =>
			expect(patches).toEqual([
				{ userId: "d-active", body: { action: "suspend", note: "" } },
			]),
		);
	});

	it("warns when dev-mcp's tool list can't be loaded", async () => {
		serve();
		serveDev({ catalogFails: true });
		renderPage("/admin/mcp-access?tab=dev");

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/tool list can't be loaded \(Dev MCP can't be reached right now\)/,
		);
	});
});
