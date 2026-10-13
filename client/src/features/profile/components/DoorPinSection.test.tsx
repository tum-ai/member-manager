import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DoorPinSection } from "./DoorPinSection";

const available = {
	status: "available",
	pin: "482913",
	updated_at: "2026-10-13T10:00:00Z",
} as const;

function renderSection(
	props: Partial<React.ComponentProps<typeof DoorPinSection>> = {},
) {
	const onToggleRevealed = vi.fn();
	render(
		<MemoryRouter>
			<DoorPinSection
				doorPin={available}
				isLoading={false}
				hasError={false}
				isRevealed={false}
				onToggleRevealed={onToggleRevealed}
				{...props}
			/>
		</MemoryRouter>,
	);
	return { onToggleRevealed };
}

describe("DoorPinSection", () => {
	it("masks the PIN until it is revealed", async () => {
		const { onToggleRevealed } = renderSection();

		expect(screen.getByRole("heading", { name: "Door PIN" })).toBeVisible();
		expect(screen.queryByText("482913")).not.toBeInTheDocument();
		expect(screen.getByText("••••••")).toBeInTheDocument();

		const toggle = screen.getByRole("button", { name: "Show PIN" });
		expect(toggle).toHaveAttribute("type", "button");
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(toggle);
		expect(onToggleRevealed).toHaveBeenCalledTimes(1);
	});

	it("shows the PIN when revealed", () => {
		renderSection({ isRevealed: true });

		expect(screen.getByText("482913")).toBeVisible();
		expect(screen.getByRole("button", { name: "Hide PIN" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("points members who haven't finished /welcome there", () => {
		renderSection({ doorPin: { status: "welcome_required" } });

		expect(screen.getByRole("link", { name: "Go to welcome" })).toHaveAttribute(
			"href",
			"/welcome",
		);
		expect(screen.queryByRole("button", { name: /pin/i })).toBeNull();
	});

	it("explains a missing PIN", () => {
		renderSection({ doorPin: { status: "not_assigned" } });

		expect(screen.getByText(/You don't have a door PIN yet/)).toBeVisible();
	});

	it("shows a loading state and an error state", () => {
		renderSection({ doorPin: undefined, isLoading: true });
		expect(
			screen.getByRole("status", { name: "Loading your door PIN" }),
		).toBeInTheDocument();
	});

	it("reports a failed load", () => {
		renderSection({ doorPin: undefined, hasError: true });
		expect(screen.getByText(/Your door PIN couldn't be loaded/)).toBeVisible();
	});
});
