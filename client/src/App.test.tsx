import { CssBaseline, ThemeProvider } from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedApp } from "./App";
import getAppTheme from "./theme";

const adminState = vi.hoisted(() => ({
	isAdmin: false,
	isLoading: true,
}));

vi.mock("./hooks/useIsAdmin", () => ({
	useIsAdmin: () => adminState,
}));

vi.mock("./features/admin/AdminDatabaseView", () => ({
	default: () => <div>Admin route</div>,
}));

vi.mock("./features/profile/ProfilePage", () => ({
	default: () => <div>Profile route</div>,
}));

vi.mock("./features/members/MemberList", () => ({
	default: () => <div>Members route</div>,
}));

vi.mock("./features/tools/ToolsPage", () => ({
	default: () => <div>Tools route</div>,
}));

vi.mock("./features/reimbursements/ReimbursementPage", () => ({
	default: () => <div>Reimbursement route</div>,
}));

vi.mock("./features/reimbursements/ReimbursementReviewPage", () => ({
	default: () => <div>Finance review route</div>,
}));

vi.mock("./features/certificate/EngagementCertificatePage", () => ({
	default: () => <div>Certificate route</div>,
}));

const mockUser = {
	id: "user-123",
	email: "admin@example.com",
} as User;

function renderAuthenticatedApp(initialRoute = "/admin") {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<CssBaseline />
			<MemoryRouter initialEntries={[initialRoute]}>
				<AuthenticatedApp
					user={mockUser}
					colorMode="light"
					onLogout={vi.fn()}
					onToggleColorMode={vi.fn()}
				/>
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("AuthenticatedApp admin routing", () => {
	beforeEach(() => {
		adminState.isAdmin = false;
		adminState.isLoading = true;
	});

	it("does not redirect direct admin URLs while the admin role is loading", () => {
		renderAuthenticatedApp("/admin");

		expect(screen.getByText(/loading admin access/i)).toBeInTheDocument();
		expect(screen.queryByText("Profile route")).not.toBeInTheDocument();
	});

	it("renders the admin view once the logged-in local user is confirmed as admin", () => {
		adminState.isAdmin = true;
		adminState.isLoading = false;

		renderAuthenticatedApp("/admin");

		expect(screen.getByText("Admin route")).toBeInTheDocument();
	});
});
