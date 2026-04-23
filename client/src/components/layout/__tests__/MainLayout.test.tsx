import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MainLayout from "../MainLayout";

const mockUser = {
	id: "test-user-id",
	email: "admin@test.com",
} as User;

function renderLayout({ isAdmin }: { isAdmin: boolean }) {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<MainLayout
				user={mockUser}
				isAdmin={isAdmin}
				colorMode="light"
				onLogout={vi.fn()}
				onToggleColorMode={vi.fn()}
			>
				<div>child</div>
			</MainLayout>
		</MemoryRouter>,
	);
}

describe("MainLayout admin navigation", () => {
	it("shows an Admin option in the view selector for admin users", async () => {
		const user = userEvent.setup();
		renderLayout({ isAdmin: true });

		await user.click(screen.getByLabelText(/view selector/i));

		expect(
			await screen.findByRole("option", { name: /Admin/i }),
		).toBeInTheDocument();
	});

	it("does not show an Admin option for non-admin users", async () => {
		const user = userEvent.setup();
		renderLayout({ isAdmin: false });

		await user.click(screen.getByLabelText(/view selector/i));

		await screen.findByRole("option", { name: /My Profile/i });
		expect(
			screen.queryByRole("option", { name: /Admin/i }),
		).not.toBeInTheDocument();
	});
});
