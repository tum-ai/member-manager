import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "../../test/mswServer";
import { renderWithClient } from "../../test/renderWithClient";
import TumaiDaysPage from "./TumaiDaysPage";
import type { TumaiDayEvent } from "./tumaiDaysTypes";

const showToast = vi.fn();
vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

function makeEvent(overrides: Partial<TumaiDayEvent> = {}): TumaiDayEvent {
	return {
		id: "evt-1",
		agenda: "Quarterly gathering",
		scheduled_at: "2026-09-01T17:00:00.000Z",
		sent_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

describe("TumaiDaysPage", () => {
	beforeEach(() => {
		showToast.mockClear();
	});

	it("renders the page shell and the scheduled events from the API", async () => {
		server.use(
			http.get("/api/tum-ai-days", () =>
				HttpResponse.json({ events: [makeEvent()] }),
			),
		);

		renderWithClient(<TumaiDaysPage />);

		expect(
			screen.getByRole("heading", { name: /tum\.ai days rsvp/i }),
		).toBeInTheDocument();
		expect(await screen.findByText("Quarterly gathering")).toBeInTheDocument();
		// No event selected yet → responses panel shows the placeholder.
		expect(screen.getByText(/no event selected/i)).toBeInTheDocument();
	});

	it("loads RSVP responses after selecting an event", async () => {
		server.use(
			http.get("/api/tum-ai-days", () =>
				HttpResponse.json({ events: [makeEvent()] }),
			),
			http.get("/api/tum-ai-days/:id/responses", () =>
				HttpResponse.json({
					event: makeEvent(),
					stats: { yes: 2, no: 1, pending: 1, total: 4 },
					responses: [
						{
							userId: "u1",
							givenName: "Alice",
							surname: "Attends",
							email: "alice@example.com",
							department: "Engineering",
							status: "yes",
							reason: null,
							votedAt: null,
						},
					],
				}),
			),
		);

		const user = userEvent.setup();
		renderWithClient(<TumaiDaysPage />);

		await user.click(await screen.findByText("Quarterly gathering"));

		expect(await screen.findByText(/audit log/i)).toBeInTheDocument();
		expect(await screen.findByText(/alice attends/i)).toBeInTheDocument();
	});

	it("shows the empty state when there are no scheduled events", async () => {
		server.use(
			http.get("/api/tum-ai-days", () => HttpResponse.json({ events: [] })),
		);

		renderWithClient(<TumaiDaysPage />);

		expect(await screen.findByText(/no scheduled events/i)).toBeInTheDocument();
	});
});
