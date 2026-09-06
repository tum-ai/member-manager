import type { User } from "@supabase/supabase-js";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import ExpertiseProfilePage from "./ExpertiseProfilePage";

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));
const USER_ID = "11111111-1111-4111-8111-111111111111";
const user = {
	id: USER_ID,
	email: "ada@example.com",
	user_metadata: {},
} as unknown as User;

const profile = {
	user_id: USER_ID,
	editable: true,
	opted_out: false,
	person: {
		user_id: USER_ID,
		headline: "Builder",
		summary: null,
		opted_out: false,
		consent_at: null,
		last_enriched_at: null,
	},
	member: {
		user_id: USER_ID,
		given_name: "Ada",
		surname: "Lovelace",
		department: "Tech",
		batch: null,
		member_role: "Member",
		board_role: null,
		avatar_url: null,
		linkedin_profile_url: null,
		linkedin_url: null,
		public_location: null,
		member_status: "active",
	},
	employment: [],
	education: [],
	skills: [],
	projects: [],
	tags: [],
	counts: { confirmed: 0, pending: 0, rejected: 0 },
};

function EmbeddedProfile(): JSX.Element {
	useSetPageHeader("Agent");
	return <ExpertiseProfilePage user={user} userId={USER_ID} />;
}

describe("ExpertiseProfilePage", () => {
	it("does not override the parent header when embedded in Agent", async () => {
		server.use(
			http.get(`/api/expertise/${USER_ID}`, () => HttpResponse.json(profile)),
			http.get("/api/expertise/meta/tags", () =>
				HttpResponse.json({ tags: [] }),
			),
		);
		renderWithClient(<EmbeddedProfile />);
		expect(
			await screen.findByRole("heading", { name: "Agent" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Expertise" }),
		).not.toBeInTheDocument();
		expect(
			await screen.findByRole("heading", {
				name: "Ada Lovelace",
				level: 2,
			}),
		).toBeInTheDocument();
	});

	it("renders a recoverable query error", async () => {
		server.use(
			http.get(`/api/expertise/${USER_ID}`, () =>
				HttpResponse.json({ message: "Unavailable" }, { status: 500 }),
			),
			http.get("/api/expertise/meta/tags", () =>
				HttpResponse.json({ tags: [] }),
			),
		);
		renderWithClient(<ExpertiseProfilePage user={user} userId={USER_ID} />);
		expect(
			await screen.findByText("Could not load this expertise profile"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /try again/i }),
		).toBeInTheDocument();
	});
});
