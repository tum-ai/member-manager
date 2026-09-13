import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import ContractFormPage from "./ContractFormPage";

const { capture } = vi.hoisted(() => ({
	capture: vi.fn(),
}));

vi.mock("@/hooks/useAnalytics", () => ({
	useAnalytics: () => ({ capture }),
}));

vi.mock("@/hooks/useCurrentUserIsAdmin", () => ({
	useCurrentUserIsAdmin: () => ({
		currentUserId: "user-123",
		isAdmin: false,
		isLoading: false,
	}),
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

const template = {
	id: "template-1",
	name: "Partner Agreement",
	description: null,
	is_active: true,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
};

function mockTemplates() {
	server.use(
		http.get("/api/contracts/templates", () => HttpResponse.json([template])),
		http.get("/api/contracts/templates/:id", () =>
			HttpResponse.json({ template, variables: [], blocks: [] }),
		),
	);
}

describe("ContractFormPage", () => {
	beforeEach(() => {
		capture.mockClear();
	});

	it("tracks a create-and-submit contract as an adoption/funnel event", async () => {
		mockTemplates();
		server.use(
			http.post("/api/contracts/submissions", () =>
				HttpResponse.json({ id: "submission-1" }),
			),
		);
		const user = userEvent.setup();
		renderWithClient(
			<MemoryRouter initialEntries={["/contracts"]}>
				<ContractFormPage />
			</MemoryRouter>,
		);

		await waitFor(() =>
			expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled(),
		);

		await user.click(screen.getByRole("button", { name: /^submit$/i }));

		await waitFor(() =>
			expect(capture).toHaveBeenCalledWith("contract_submitted"),
		);
	});

	it("tracks saving a contract as a draft separately from submitting", async () => {
		mockTemplates();
		server.use(
			http.post("/api/contracts/submissions", () =>
				HttpResponse.json({ id: "submission-1" }),
			),
		);
		const user = userEvent.setup();
		renderWithClient(
			<MemoryRouter initialEntries={["/contracts"]}>
				<ContractFormPage />
			</MemoryRouter>,
		);

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /save as draft/i }),
			).toBeEnabled(),
		);

		await user.click(screen.getByRole("button", { name: /save as draft/i }));

		await waitFor(() =>
			expect(capture).toHaveBeenCalledWith("contract_draft_saved"),
		);
	});
});
