import type { User } from "@supabase/supabase-js";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import WelcomePage from "./WelcomePage";

const { showToast, memberState } = vi.hoisted(() => ({
	showToast: vi.fn(),
	memberState: {
		member: { given_name: "Nico", member_status: "active" } as
			| { given_name: string; member_status: string }
			| undefined,
	},
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

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("@/hooks/useMemberData", () => ({
	useMemberData: () => ({ ...memberState, isLoading: false, error: null }),
}));

// The CV panel has its own tests; here it only has to be on the page.
vi.mock("@/features/profile/CvPanel", () => ({
	CvPanel: () => <div>CV panel</div>,
}));

const user = { id: "user-1", email: "nico@example.com" } as User;

const undecided = {
	privacy_policy_agreed: false,
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: false,
	consents_decided_at: null,
};

function stubConsents(stored: typeof undecided | Record<string, unknown>) {
	const puts: unknown[] = [];
	server.use(
		http.get("/api/members/:id/consents", () => HttpResponse.json(stored)),
		http.put("/api/members/:id/consents", async ({ request }) => {
			const body = (await request.json()) as Record<string, unknown>;
			puts.push(body);
			return HttpResponse.json({
				...body,
				consents_decided_at: "2026-10-04T10:00:00Z",
			});
		}),
	);
	return puts;
}

const storedCv = {
	id: "cv-1",
	version: 1,
	source: "member_upload",
	original_filename: "cv.pdf",
	size_bytes: 1024,
	mime_type: "application/pdf",
	sha256: "abc",
	uploaded_at: "2026-10-01T00:00:00Z",
	is_current: true,
};

function stubCv(cv: typeof storedCv | null) {
	server.use(http.get("/api/members/:id/cv", () => HttpResponse.json({ cv })));
}

function renderPage(from?: string) {
	return renderWithClient(
		<MemoryRouter
			initialEntries={[{ pathname: "/welcome", state: from ? { from } : null }]}
		>
			<Routes>
				<Route path="/welcome" element={<WelcomePage user={user} />} />
				<Route path="/" element={<div>Profile route</div>} />
				<Route path="/tools/jobs" element={<div>Jobs route</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

const checkbox = (name: RegExp) => screen.getByRole("checkbox", { name });

describe("WelcomePage", () => {
	beforeEach(() => {
		showToast.mockReset();
		memberState.member = { given_name: "Nico", member_status: "active" };
		stubCv(storedCv);
	});

	it("starts an undecided member with nothing ticked", async () => {
		stubConsents(undecided);
		renderPage();

		await screen.findByText("Your consent");
		for (const name of [
			/privacy policy/i,
			/displaying my/i,
			/photos/i,
			/cv/i,
		]) {
			expect(checkbox(name)).not.toBeChecked();
		}
		expect(screen.getByText("CV panel")).toBeInTheDocument();
	});

	it("agrees to all, saves in one request and then offers to continue", async () => {
		const puts = stubConsents(undecided);
		const userEvents = userEvent.setup();
		renderPage();

		await userEvents.click(
			await screen.findByRole("button", { name: "Agree to all" }),
		);
		await userEvents.click(
			screen.getByRole("button", { name: "Save my choices" }),
		);

		await waitFor(() =>
			expect(puts).toEqual([
				{
					privacy_policy_agreed: true,
					website_profile_consent: true,
					event_photos_consent: true,
					partner_sharing_consent: true,
				},
			]),
		);
		expect(showToast).toHaveBeenCalledWith(
			"Your consent choices are saved.",
			"success",
		);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
		);
		await userEvents.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByText("Profile route")).toBeInTheDocument();
	});

	it("requires the privacy acknowledgement before saving, but no optional consent", async () => {
		const puts = stubConsents(undecided);
		const userEvents = userEvent.setup();
		renderPage();

		await screen.findByText("Your consent");
		const save = screen.getByRole("button", { name: "Save my choices" });
		expect(save).toBeDisabled();
		expect(save).toHaveAccessibleDescription(
			/read the Privacy Policy and Data Privacy Notice/,
		);

		await userEvents.click(
			checkbox(
				/read and understood the TUM\.ai Privacy Policy and Data Privacy Notice/i,
			),
		);
		expect(save).toBeEnabled();
		await userEvents.click(save);

		await waitFor(() =>
			expect(puts).toEqual([
				{
					privacy_policy_agreed: true,
					website_profile_consent: false,
					event_photos_consent: false,
					partner_sharing_consent: false,
				},
			]),
		);
	});

	it("opens a document from the acknowledgement without ticking it", async () => {
		stubConsents(undecided);
		const userEvents = userEvent.setup();
		renderPage();

		await screen.findByText("Your consent");
		await userEvents.click(
			screen.getByRole("button", { name: "Data Privacy Notice" }),
		);

		expect(
			await screen.findByRole("dialog", { name: "Data Privacy Notice" }),
		).toBeInTheDocument();
		// The open dialog hides the page from role queries; close it first.
		await userEvents.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(checkbox(/read and understood/i)).not.toBeChecked();
	});

	it("saves each purpose separately, including refusals", async () => {
		const puts = stubConsents(undecided);
		const userEvents = userEvent.setup();
		renderPage();

		await screen.findByText("Your consent");
		await userEvents.click(checkbox(/privacy policy/i));
		await userEvents.click(checkbox(/cv/i));
		await userEvents.click(
			screen.getByRole("button", { name: "Save my choices" }),
		);

		await waitFor(() =>
			expect(puts).toEqual([
				{
					privacy_policy_agreed: true,
					website_profile_consent: false,
					event_photos_consent: false,
					partner_sharing_consent: true,
				},
			]),
		);
	});

	it("shows a decided member their stored choices", async () => {
		stubConsents({
			...undecided,
			privacy_policy_agreed: true,
			partner_sharing_consent: true,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		renderPage();

		await waitFor(() => expect(checkbox(/cv/i)).toBeChecked());
		expect(checkbox(/photos/i)).not.toBeChecked();
		expect(
			screen.getByRole("button", { name: "Choices saved" }),
		).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: "Later" }),
		).not.toBeInTheDocument();
	});

	it("withdraws a partner-only consent without granting the other purposes", async () => {
		// Regression (review on #368): a partial decision must stay editable
		// purpose by purpose.
		const puts = stubConsents({
			...undecided,
			privacy_policy_agreed: true,
			partner_sharing_consent: true,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		const userEvents = userEvent.setup();
		renderPage();

		await waitFor(() => expect(checkbox(/cv/i)).toBeChecked());
		await userEvents.click(checkbox(/cv/i));
		await userEvents.click(
			screen.getByRole("button", { name: "Save my choices" }),
		);

		await waitFor(() =>
			expect(puts).toEqual([
				{
					privacy_policy_agreed: true,
					website_profile_consent: false,
					event_photos_consent: false,
					partner_sharing_consent: false,
				},
			]),
		);
	});

	it("offers no way to skip before deciding and uploading a CV", async () => {
		stubConsents(undecided);
		stubCv(null);
		renderPage("/tools/jobs");

		await screen.findByText("Your consent");
		const proceed = await screen.findByRole("button", { name: "Continue" });
		await waitFor(() => expect(proceed).toBeDisabled());
		expect(proceed).toHaveAccessibleDescription(
			"To continue, save your consent choices and upload your CV.",
		);
		expect(
			screen.queryByRole("button", { name: "Later" }),
		).not.toBeInTheDocument();
	});

	it("still requires the CV from a member who has already decided", async () => {
		stubConsents({
			...undecided,
			privacy_policy_agreed: true,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		stubCv(null);
		renderPage();

		const proceed = await screen.findByRole("button", { name: "Continue" });
		await waitFor(() =>
			expect(proceed).toHaveAccessibleDescription(
				"To continue, upload your CV.",
			),
		);
		expect(proceed).toBeDisabled();
	});

	it("counts a refusal as a decision", async () => {
		stubConsents({
			...undecided,
			privacy_policy_agreed: true,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		renderPage();

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
		);
	});

	it("doesn't ask alumni for a CV", async () => {
		memberState.member = { given_name: "Nico", member_status: "alumni" };
		stubConsents({
			...undecided,
			privacy_policy_agreed: true,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		stubCv(null);
		renderPage();

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
		);
	});

	it("returns a finished member to the page they were sent from", async () => {
		stubConsents({
			...undecided,
			privacy_policy_agreed: true,
			consents_decided_at: "2026-09-01T00:00:00Z",
		});
		const userEvents = userEvent.setup();
		renderPage("/tools/jobs");

		const proceed = await screen.findByRole("button", { name: "Continue" });
		await waitFor(() => expect(proceed).toBeEnabled());
		await userEvents.click(proceed);

		expect(screen.getByText("Jobs route")).toBeInTheDocument();
	});

	it("lets an unlinked account decide and asks the member to get it merged", async () => {
		// A first Slack login with a different email creates a nameless account;
		// consent and CV saved there move over when an admin merges it.
		const puts = stubConsents(undecided);
		memberState.member = { given_name: "", member_status: "active" };
		const userEvents = userEvent.setup();
		renderPage();

		expect(
			await screen.findByText(
				"Your Slack account isn't linked to your membership yet",
			),
		).toBeInTheDocument();
		expect(screen.getByText("CV panel")).toBeInTheDocument();
		await userEvents.click(
			screen.getByRole("button", { name: "Agree to all" }),
		);
		await userEvents.click(
			screen.getByRole("button", { name: "Save my choices" }),
		);
		await waitFor(() => expect(puts).toHaveLength(1));
	});

	it("shows no link notice for a matched account", async () => {
		stubConsents(undecided);
		renderPage();

		await screen.findByText("Your consent");
		expect(
			screen.queryByText(/isn't linked to your membership/),
		).not.toBeInTheDocument();
	});
	it("reports a failed save", async () => {
		stubConsents(undecided);
		server.use(
			http.put("/api/members/:id/consents", () =>
				HttpResponse.json({ error: "Database error" }, { status: 500 }),
			),
		);
		const userEvents = userEvent.setup();
		renderPage();

		await screen.findByText("Your consent");
		await userEvents.click(checkbox(/privacy policy/i));
		await userEvents.click(
			screen.getByRole("button", { name: "Save my choices" }),
		);

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(expect.any(String), "error"),
		);
		expect(
			screen.getByRole("button", { name: "Save my choices" }),
		).toBeEnabled();
	});
});
