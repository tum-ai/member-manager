import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../contexts/ToastContext";
import MainLayout from "../MainLayout";

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
}: {
	isAdmin: boolean;
	hasContractsAccess?: boolean;
}) {
	return render(
		<ToastProvider>
			<MemoryRouter initialEntries={["/"]}>
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

	it("always shows Profile, Members and Tools nav entries", () => {
		renderLayout({ isAdmin: false });

		expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /members/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Tools")).toBeInTheDocument();
	});

	it("shows an Admin nav group for admin users", () => {
		renderLayout({ isAdmin: true });

		expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
	});

	it("does not show an Admin link for non-admin users", () => {
		renderLayout({ isAdmin: false });

		expect(
			screen.queryByRole("link", { name: /admin/i }),
		).not.toBeInTheDocument();
	});

	it("shows a Contracts entry only when the user has contracts access", () => {
		renderLayout({ isAdmin: false, hasContractsAccess: false });
		expect(screen.queryByText("Contracts")).not.toBeInTheDocument();

		renderLayout({ isAdmin: false, hasContractsAccess: true });
		expect(screen.getByText("Contracts")).toBeInTheDocument();
	});

	it("keeps a report bug action at the bottom of the layout", () => {
		renderLayout({ isAdmin: false });

		expect(
			screen.getByRole("button", { name: /report a bug/i }),
		).toBeInTheDocument();
	});
});
