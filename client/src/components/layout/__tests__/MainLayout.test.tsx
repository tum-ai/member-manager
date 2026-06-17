import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../contexts/ToastContext";
import { MainLayout } from "../MainLayout";

const toolAccessState = vi.hoisted(() => ({
	permissions: [] as string[],
	isLoading: false,
}));

vi.mock("../../../hooks/useToolAccess", () => ({
	useToolAccess: () => toolAccessState,
}));

const mockUser = {
	id: "test-user-id",
	email: "admin@test.com",
} as User;

function renderLayout({
	isAdmin,
	hasContractsAccess = false,
	route = "/",
}: {
	isAdmin: boolean;
	hasContractsAccess?: boolean;
	route?: string;
}) {
	return render(
		<ToastProvider>
			<MemoryRouter initialEntries={[route]}>
				<MainLayout
					user={mockUser}
					isAdmin={isAdmin}
					hasContractsAccess={hasContractsAccess}
					onLogout={vi.fn()}
				>
					<div>child</div>
				</MainLayout>
			</MemoryRouter>
		</ToastProvider>,
	);
}

describe("MainLayout sidebar navigation", () => {
	it("renders the TUM.ai logo (light and dark variants) in the sidebar", () => {
		renderLayout({ isAdmin: true });

		const logos = screen.getAllByAltText("TUM.ai");
		expect(logos.map((logo) => logo.getAttribute("src"))).toEqual([
			"/img/tum_ai_logo_mark_light.svg",
			"/img/tum_ai_logo_mark_dark.svg",
		]);
	});

	it("always shows the Profile link, the Members menu and the Tools section", () => {
		renderLayout({ isAdmin: false });

		expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Members" })).toBeInTheDocument();
		expect(screen.getByText("Tools")).toBeInTheDocument();
	});

	it("surfaces Research and Task Forces as their own member nav links", () => {
		// Render within the members area so the (collapsible) Members menu is open.
		renderLayout({ isAdmin: false, route: "/members" });

		expect(screen.getByRole("link", { name: /research/i })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /task forces/i }),
		).toBeInTheDocument();
	});

	it("shows an Administration section for admin users", () => {
		renderLayout({ isAdmin: true });

		expect(screen.getByText("Administration")).toBeInTheDocument();
	});

	it("does not show the Administration section for non-admin users", () => {
		renderLayout({ isAdmin: false });

		expect(screen.queryByText("Administration")).not.toBeInTheDocument();
	});

	it("shows the Legal department only when the user has contracts access", () => {
		renderLayout({ isAdmin: false, hasContractsAccess: false });
		expect(screen.queryByText("Legal")).not.toBeInTheDocument();

		renderLayout({ isAdmin: false, hasContractsAccess: true });
		expect(screen.getByText("Legal")).toBeInTheDocument();
	});

	it("reveals the gated Finance Review tool only with the finance.review permission", () => {
		// Render at the reimbursement route so the (collapsible) Finance
		// department is expanded and its items are mounted.
		renderLayout({ isAdmin: false, route: "/tools/reimbursement" });
		expect(
			screen.queryByRole("link", { name: /finance review/i }),
		).not.toBeInTheDocument();

		toolAccessState.permissions = ["finance.review"];
		renderLayout({ isAdmin: false, route: "/tools/reimbursement" });
		expect(
			screen.getByRole("link", { name: /finance review/i }),
		).toBeInTheDocument();
		toolAccessState.permissions = [];
	});

	it("keeps a report bug action at the bottom of the layout", () => {
		renderLayout({ isAdmin: false });

		expect(
			screen.getByRole("button", { name: /report a bug/i }),
		).toBeInTheDocument();
	});
});
