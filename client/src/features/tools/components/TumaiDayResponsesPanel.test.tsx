import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
	EventResponsesPayload,
	RSVPResponse,
	TumaiDayEvent,
} from "@/features/tools/tumaiDaysTypes";
import { TumaiDayResponsesPanel } from "./TumaiDayResponsesPanel";

const event: TumaiDayEvent = {
	id: "evt-1",
	agenda: "Quarterly meetup",
	scheduled_at: "2026-01-01T10:00:00.000Z",
	sent_at: null,
	created_at: "2025-12-01T10:00:00.000Z",
};

const responses: RSVPResponse[] = [
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
	{
		userId: "u2",
		givenName: "Bob",
		surname: "Declines",
		email: "bob@example.com",
		department: "Venture",
		status: "no",
		reason: "Travelling",
		votedAt: null,
	},
];

const responsesData: EventResponsesPayload = {
	event,
	stats: { yes: 1, no: 1, pending: 2, total: 4 },
	responses,
};

function renderPanel(
	overrides: Partial<React.ComponentProps<typeof TumaiDayResponsesPanel>> = {},
) {
	const props: React.ComponentProps<typeof TumaiDayResponsesPanel> = {
		selectedEventId: "evt-1",
		isLoading: false,
		responsesData,
		selectedEvent: event,
		responseRate: 50,
		filteredResponses: responses,
		searchTerm: "",
		onSearchTermChange: vi.fn(),
		statusFilter: "all",
		onStatusFilterChange: vi.fn(),
		...overrides,
	};
	render(<TumaiDayResponsesPanel {...props} />);
	return props;
}

describe("TumaiDayResponsesPanel", () => {
	it("prompts to pick an event when none is selected", () => {
		renderPanel({ selectedEventId: null });

		expect(screen.getByText(/no event selected/i)).toBeInTheDocument();
	});

	it("shows an error when the responses payload is missing", () => {
		renderPanel({ responsesData: undefined });

		expect(
			screen.getByText(/failed to load rsvp details/i),
		).toBeInTheDocument();
	});

	it("renders the audit stats and response rate", () => {
		renderPanel({ responseRate: 50 });

		expect(screen.getByText("50%")).toBeInTheDocument();
		expect(screen.getByText("Quarterly meetup")).toBeInTheDocument();
		expect(screen.getByText("Attending")).toBeInTheDocument();
	});

	it("renders one table row per response with its status badge", () => {
		renderPanel();

		expect(screen.getByText(/alice attends/i)).toBeInTheDocument();
		expect(screen.getByText(/bob declines/i)).toBeInTheDocument();
		expect(screen.getByText("Travelling")).toBeInTheDocument();
	});

	it("shows an empty-results row when filters exclude everyone", () => {
		renderPanel({ filteredResponses: [] });

		expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
	});

	it("forwards search input", async () => {
		const user = userEvent.setup();
		const props = renderPanel();

		await user.type(screen.getByLabelText(/search by name or email/i), "a");

		expect(props.onSearchTermChange).toHaveBeenCalledWith("a");
	});

	it("forwards a status-filter change", async () => {
		const user = userEvent.setup();
		const props = renderPanel();

		await user.click(screen.getByLabelText(/response status/i));
		await user.click(
			await within(await screen.findByRole("listbox")).findByRole("option", {
				name: /declined \(no\)/i,
			}),
		);

		expect(props.onStatusFilterChange).toHaveBeenCalledWith("no");
	});
});
