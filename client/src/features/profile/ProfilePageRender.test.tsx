import type { User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";

const showToast = vi.fn();
const onSubmit = vi.fn();
const handleDownloadMembershipProof = vi.fn();

let memberData: Record<string, unknown> | undefined;
let isAdmin = false;
let isLoadingMember = false;
const updateMemberAsync = vi.fn();

let sepaData: Record<string, unknown> | undefined;
const updateSepaAsync = vi.fn();

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../hooks/useMemberData", () => ({
	useMemberData: () => ({
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: false,
	}),
}));

vi.mock("../../hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin, isLoading: false }),
}));

vi.mock("../../hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({ researchProjects: [], isLoading: false }),
}));

vi.mock("../../hooks/useSepaData", () => ({
	useSepaData: () => ({
		sepa: sepaData,
		isLoading: false,
		updateSepaAsync,
		isUpdating: false,
	}),
}));

vi.mock("./hooks/useMembershipProof", () => ({
	useMembershipProof: () => ({
		isGeneratingPdf: false,
		handleDownloadMembershipProof,
	}),
}));

vi.mock("./hooks/useMemberChangeRequestForm", () => ({
	useMemberChangeRequestForm: () => ({
		requestedRole: "",
		setRequestedRole: vi.fn(),
		requestedDepartment: "",
		setRequestedDepartment: vi.fn(),
		isRequestingAlumniStatus: false,
		setIsRequestingAlumniStatus: vi.fn(),
		changeRequestReason: "",
		setChangeRequestReason: vi.fn(),
		latestMemberChangeRequest: null,
		isSubmittingChangeRequest: false,
		handleSubmitMemberChangeRequest: vi.fn(),
	}),
}));

// CvPanel fetches via useMemberCv; stub it so ProfilePage renders without network.
vi.mock("./CvPanel", () => ({
	CvPanel: () => <div data-testid="cv-panel" />,
}));

const user = {
	id: "user-1",
	email: "ada@tum.ai",
	user_metadata: { given_name: "Ada", family_name: "Lovelace" },
} as unknown as User;

beforeEach(() => {
	vi.clearAllMocks();
	memberData = {
		given_name: "Ada",
		surname: "Lovelace",
		department: "Venture",
	};
	isAdmin = false;
	isLoadingMember = false;
	sepaData = undefined;
	onSubmit.mockResolvedValue(undefined);
});

describe("ProfilePage (render)", () => {
	it("renders the loading skeleton while data is loading", () => {
		isLoadingMember = true;
		render(<ProfilePage user={user} />);
		expect(
			screen.queryByRole("heading", { name: /personal information/i }),
		).not.toBeInTheDocument();
	});

	it("renders the profile shell and derives the header from member data", async () => {
		render(<ProfilePage user={user} />);

		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: /personal information/i }),
			).toBeInTheDocument(),
		);
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		// department + role joined with a middot.
		expect(screen.getByText(/Venture · Member/)).toBeInTheDocument();
		expect(screen.getByTestId("cv-panel")).toBeInTheDocument();
	});

	it("shows the request-changes section for non-admin members", async () => {
		isAdmin = false;
		render(<ProfilePage user={user} />);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", {
					name: /request role, department, or status changes/i,
				}),
			).toBeInTheDocument(),
		);
	});

	it("hides the request-changes section for admins", async () => {
		isAdmin = true;
		render(<ProfilePage user={user} />);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: /personal information/i }),
			).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("heading", {
				name: /request role, department, or status changes/i,
			}),
		).not.toBeInTheDocument();
	});

	it("opens the SEPA mandate modal from the banking section", async () => {
		const userEv = userEvent.setup();
		render(<ProfilePage user={user} />);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: /personal information/i }),
			).toBeInTheDocument(),
		);

		await userEv.click(screen.getByRole("button", { name: /sepa mandate/i }));

		expect(
			await screen.findByRole("dialog", { name: /sepa mandate agreement/i }),
		).toBeInTheDocument();
	});

	it("derives an empty header when there is no name or department", async () => {
		memberData = { given_name: "", surname: "", department: "" };
		const namelessUser = {
			id: "user-1",
			email: "ada@tum.ai",
			user_metadata: {},
		} as unknown as User;
		render(<ProfilePage user={namelessUser} />);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: /personal information/i }),
			).toBeInTheDocument(),
		);
		// With no name set, ProfilePage produces a blank full name (no header
		// chip) instead of the Slack-derived "Ada Lovelace".
		expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
	});
});
