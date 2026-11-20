import type { User } from "@supabase/supabase-js";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import ProfilePage from "./ProfilePage";

const showToast = vi.fn();
const onSubmit = vi.fn();
const handleDownloadMembershipProof = vi.fn();

let memberData: Record<string, unknown> = {};
let isAdmin = false;
let isLoadingMember = false;
let sepaData: Record<string, unknown> = {};
let putBodies: Array<Record<string, unknown>> = [];

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

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin, isLoading: false }),
}));

vi.mock("../../hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({ researchProjects: [], isLoading: false }),
}));

vi.mock("../../hooks/useMemberConsents", () => ({
	useMemberConsents: () => ({ consents: undefined }),
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
		memberChangeRequests: [],
		isSubmittingChangeRequest: false,
		handleSubmitMemberChangeRequest: vi.fn(),
	}),
}));

const toggleDoorPin = vi.fn();
vi.mock("./hooks/useDoorPin", () => ({
	useDoorPin: () => ({
		doorPin: { status: "available", pin: "482913", updated_at: "" },
		isLoading: false,
		hasError: false,
		isRevealed: false,
		toggleRevealed: toggleDoorPin,
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
	sepaData = {};
	putBodies = [];
	onSubmit.mockResolvedValue(undefined);
	const profile = () => ({
		version: 2,
		member: { user_id: "user-1", email: "ada@tum.ai", ...memberData },
		sepa: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
			...sepaData,
		},
		completeness: { percent: 35, missing: ["IBAN"] },
	});
	server.use(
		http.get("/api/profile/user-1", () =>
			isLoadingMember
				? new Promise<never>(() => {})
				: HttpResponse.json(profile()),
		),
		http.put("/api/profile/user-1", async ({ request }) => {
			putBodies.push((await request.json()) as Record<string, unknown>);
			return HttpResponse.json(profile());
		}),
	);
});

describe("ProfilePage (render)", () => {
	it("renders the loading skeleton while data is loading", () => {
		isLoadingMember = true;
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
		expect(
			screen.queryByRole("heading", { name: /personal information/i }),
		).not.toBeInTheDocument();
	});

	it("renders the profile shell and derives the header from member data", async () => {
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);

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
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
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
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
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

	it("shows the door PIN card masked, and revealing it doesn't submit the profile", async () => {
		const userEv = userEvent.setup();
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: "Door PIN" }),
			).toBeInTheDocument(),
		);
		expect(screen.queryByText("482913")).not.toBeInTheDocument();

		await userEv.click(screen.getByRole("button", { name: /show pin/i }));

		expect(toggleDoorPin).toHaveBeenCalledTimes(1);
		expect(putBodies).toHaveLength(0);
	});

	it("opens the SEPA mandate modal from the banking section", async () => {
		const userEv = userEvent.setup();
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
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

	it("submits the profile when Save Changes is clicked with empty bank fields", async () => {
		// Regression for #304: native `required` on IBAN/Bank Name blocked the
		// browser submit, so onSubmit never ran for members without bank details.
		memberData = {
			given_name: "Ada",
			surname: "Lovelace",
			department: "Venture",
			degree: "Bachelor Informatics",
		};
		sepaData = {
			user_id: "user-1",
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
		};
		const userEv = userEvent.setup();
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: /personal information/i }),
			).toBeInTheDocument(),
		);
		expect(screen.getByLabelText("IBAN")).toHaveValue("");

		const [saveButton] = screen.getAllByRole("button", {
			name: /save changes/i,
		});
		await userEv.click(saveButton);

		await waitFor(() => expect(putBodies).toHaveLength(1));
		expect(putBodies[0].version).toBe(2);
		expect((putBodies[0].member as Record<string, unknown>).degree).toBe(
			"Bachelor Informatics",
		);
		expect((putBodies[0].sepa as Record<string, unknown>).iban).toBe("");
		expect(showToast).toHaveBeenCalledWith(
			"Profile saved successfully!",
			"success",
		);
	});

	it("shows the completeness the server computed", async () => {
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
		await waitFor(() => expect(screen.getByText(/35\s?%/)).toBeInTheDocument());
	});

	it("marks a prefilled batch as a suggestion, not a stored value (#397)", async () => {
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
		await waitFor(() =>
			expect(screen.getAllByText(/suggested for you/i).length).toBeGreaterThan(
				0,
			),
		);
	});

	it("shows an error instead of an editable form when the profile cannot load", async () => {
		server.use(
			http.get("/api/profile/user-1", () =>
				HttpResponse.json({ error: "Boom" }, { status: 500 }),
			),
		);
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={user} />
			</MemoryRouter>,
		);
		expect(
			await screen.findByText(/couldn't load your profile/i),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: /personal information/i }),
		).not.toBeInTheDocument();
	});

	it("derives an empty header when there is no name or department", async () => {
		memberData = { given_name: "", surname: "", department: "" };
		const namelessUser = {
			id: "user-1",
			email: "ada@tum.ai",
			user_metadata: {},
		} as unknown as User;
		renderWithClient(
			<MemoryRouter>
				<ProfilePage user={namelessUser} />
			</MemoryRouter>,
		);
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
