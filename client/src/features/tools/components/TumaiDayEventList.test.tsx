import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TumaiDayEvent } from "@/features/tools/tumaiDaysTypes";
import { TumaiDayEventList } from "./TumaiDayEventList";

const futureEvent: TumaiDayEvent = {
	id: "evt-future",
	agenda: "Future gathering",
	scheduled_at: "2999-01-01T10:00:00.000Z",
	sent_at: null,
	created_at: "2025-01-01T10:00:00.000Z",
};

const pastEvent: TumaiDayEvent = {
	id: "evt-past",
	agenda: "Past gathering",
	scheduled_at: "2000-01-01T10:00:00.000Z",
	sent_at: null,
	created_at: "2000-01-01T10:00:00.000Z",
};

const sentEvent: TumaiDayEvent = {
	id: "evt-sent",
	agenda: "Delivered gathering",
	scheduled_at: "2000-01-01T10:00:00.000Z",
	sent_at: "2000-01-02T10:00:00.000Z",
	created_at: "2000-01-01T10:00:00.000Z",
};

function renderList(
	overrides: Partial<React.ComponentProps<typeof TumaiDayEventList>> = {},
) {
	const props: React.ComponentProps<typeof TumaiDayEventList> = {
		events: [futureEvent],
		isLoading: false,
		hasError: false,
		selectedEventId: null,
		isSendPending: false,
		onSelectEvent: vi.fn(),
		onSendPending: vi.fn(),
		onStartEdit: vi.fn(),
		onDelete: vi.fn(),
		...overrides,
	};
	render(<TumaiDayEventList {...props} />);
	return props;
}

describe("TumaiDayEventList", () => {
	it("shows the empty state when there are no events", () => {
		renderList({ events: [] });

		expect(screen.getByText(/no scheduled events/i)).toBeInTheDocument();
	});

	it("shows an error alert when loading failed", () => {
		renderList({ events: [], hasError: true });

		expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
	});

	it("renders distinct status badges per event state", () => {
		renderList({ events: [futureEvent, pastEvent, sentEvent] });

		expect(screen.getByText("Scheduled")).toBeInTheDocument();
		expect(screen.getByText(/pending send/i)).toBeInTheDocument();
		expect(screen.getByText(/^sent /i)).toBeInTheDocument();
	});

	it("selects an event when its row is clicked", async () => {
		const user = userEvent.setup();
		const props = renderList();

		await user.click(screen.getByText("Future gathering"));

		expect(props.onSelectEvent).toHaveBeenCalledWith("evt-future");
	});

	it("fires edit and delete callbacks without selecting the row twice", async () => {
		const user = userEvent.setup();
		const props = renderList();

		await user.click(screen.getByRole("button", { name: /edit event/i }));
		expect(props.onStartEdit).toHaveBeenCalledOnce();
		expect(vi.mocked(props.onStartEdit).mock.calls[0][0]).toMatchObject({
			id: "evt-future",
		});

		await user.click(screen.getByRole("button", { name: /delete event/i }));
		expect(props.onDelete).toHaveBeenCalledWith(
			"evt-future",
			expect.anything(),
		);
	});

	it("triggers the scheduler check", async () => {
		const user = userEvent.setup();
		const props = renderList();

		await user.click(screen.getByRole("button", { name: /check scheduler/i }));

		expect(props.onSendPending).toHaveBeenCalledOnce();
	});

	it("disables the scheduler button while a send is pending", () => {
		renderList({ isSendPending: true });

		expect(
			screen.getByRole("button", { name: /check scheduler/i }),
		).toBeDisabled();
	});
});
