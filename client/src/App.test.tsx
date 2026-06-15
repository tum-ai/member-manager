import type { User } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedApp } from "./App";
import { ToastProvider } from "./contexts/ToastContext";

const adminState = vi.hoisted(() => ({
	isAdmin: false,
	isLoading: true,
}));

const toolAccessState = vi.hoisted(() => ({
	permissions: [] as string[],
	isLoading: false,
}));

vi.mock("./hooks/useIsAdmin", () => ({
	useIsAdmin: () => adminState,
}));

vi.mock("./hooks/useToolAccess", () => ({
	useToolAccess: () => toolAccessState,
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

vi.mock("./features/jobs/JobPostingsPage", () => ({
	default: () => <div>Jobs route</div>,
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

vi.mock("./features/contracts/ContractFormPage", () => ({
	default: () => <div>Contract form route</div>,
}));

vi.mock("./features/contracts/ContractTemplatesPage", () => ({
	default: () => <div>Contract templates route</div>,
}));

vi.mock("./features/contracts/ContractSubmissionsPage", () => ({
	default: () => <div>Contract submissions route</div>,
}));

vi.mock("./features/contracts/ContractSubmissionDetailPage", () => ({
	default: () => <div>Contract submission detail route</div>,
}));

const mockUser = {
	id: "user-123",
	email: "admin@example.com",
} as User;

function renderAuthenticatedApp(initialRoute = "/admin") {
	return render(
		<ToastProvider>
			<MemoryRouter initialEntries={[initialRoute]}>
				<AuthenticatedApp user={mockUser} onLogout={vi.fn()} />
			</MemoryRouter>
		</ToastProvider>,
	);
}

describe("AuthenticatedApp admin routing", () => {
	beforeEach(() => {
		adminState.isAdmin = false;
		adminState.isLoading = true;
	});

	it("does not redirect direct admin URLs while the admin role is loading", () => {
		renderAuthenticatedApp("/admin");

		expect(screen.getByText(/checking access/i)).toBeInTheDocument();
		expect(screen.queryByText("Profile route")).not.toBeInTheDocument();
	});

	it("renders the admin view once the logged-in local user is confirmed as admin", () => {
		adminState.isAdmin = true;
		adminState.isLoading = false;

		renderAuthenticatedApp("/admin");

		expect(screen.getByText("Admin route")).toBeInTheDocument();
	});
});

describe("AuthenticatedApp permission-gated routes", () => {
	beforeEach(() => {
		adminState.isAdmin = false;
		adminState.isLoading = false;
		toolAccessState.permissions = [];
		toolAccessState.isLoading = false;
	});

	it("redirects contract-admin routes home when the permission is missing", () => {
		renderAuthenticatedApp("/contracts/submissions");

		expect(screen.getByText("Profile route")).toBeInTheDocument();
		expect(
			screen.queryByText("Contract submissions route"),
		).not.toBeInTheDocument();
	});

	it("renders contract-admin routes when the contracts.admin permission is present", () => {
		toolAccessState.permissions = ["contracts.admin"];

		renderAuthenticatedApp("/contracts/submissions");

		expect(screen.getByText("Contract submissions route")).toBeInTheDocument();
	});

	it("shows a loading state instead of redirecting while permissions load", () => {
		toolAccessState.isLoading = true;

		renderAuthenticatedApp("/contracts/templates");

		expect(screen.getByText(/checking access/i)).toBeInTheDocument();
		expect(screen.queryByText("Profile route")).not.toBeInTheDocument();
	});

	it("redirects the create-contract route when the permission is missing", () => {
		renderAuthenticatedApp("/contracts");

		expect(screen.getByText("Profile route")).toBeInTheDocument();
		expect(screen.queryByText("Contract form route")).not.toBeInTheDocument();
	});

	it("renders the create-contract route when the permission is present", () => {
		toolAccessState.permissions = ["contracts.admin"];

		renderAuthenticatedApp("/contracts");

		expect(screen.getByText("Contract form route")).toBeInTheDocument();
	});

	it("redirects finance review home when the finance.review permission is missing", () => {
		renderAuthenticatedApp("/tools/reimbursement/review");

		expect(screen.getByText("Profile route")).toBeInTheDocument();
		expect(screen.queryByText("Finance review route")).not.toBeInTheDocument();
	});

	it("renders the member jobs route without extra permissions", () => {
		renderAuthenticatedApp("/tools/jobs");

		expect(screen.getByText("Jobs route")).toBeInTheDocument();
	});
});
