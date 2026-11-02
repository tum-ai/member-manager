import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
	showToast.mockReset();
});

describe("AdminMcpAccessPage", () => {
	it("lists pending requests first, then approved, then declined", async () => {
		serve();
		renderWithClient(<AdminMcpAccessPage />);

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
		renderWithClient(<AdminMcpAccessPage />);

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
		renderWithClient(<AdminMcpAccessPage />);

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
		renderWithClient(<AdminMcpAccessPage />);

		expect(await screen.findByText("Unable to load requests")).toBeVisible();
		expect(screen.getByText("Database down")).toBeVisible();
	});
});
