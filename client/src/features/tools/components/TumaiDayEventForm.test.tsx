import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TumaiDayEventForm } from "./TumaiDayEventForm";

function renderForm(
	overrides: Partial<React.ComponentProps<typeof TumaiDayEventForm>> = {},
) {
	const props: React.ComponentProps<typeof TumaiDayEventForm> = {
		agenda: "",
		onAgendaChange: vi.fn(),
		scheduledAt: "",
		onScheduledAtChange: vi.fn(),
		isEditing: false,
		isCreating: false,
		isUpdating: false,
		onSubmit: vi.fn((e) => e.preventDefault()),
		onCancelEdit: vi.fn(),
		...overrides,
	};
	render(<TumaiDayEventForm {...props} />);
	return props;
}

describe("TumaiDayEventForm", () => {
	it("shows the create copy and hides cancel when not editing", () => {
		renderForm();

		expect(
			screen.getByRole("heading", { name: /schedule event/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /schedule event/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /cancel/i }),
		).not.toBeInTheDocument();
	});

	it("switches to edit copy and exposes cancel when editing", async () => {
		const user = userEvent.setup();
		const props = renderForm({ isEditing: true });

		expect(
			screen.getByRole("heading", { name: /edit event/i }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /cancel/i }));
		expect(props.onCancelEdit).toHaveBeenCalledOnce();
	});

	it("forwards agenda typing to the change handler", async () => {
		const user = userEvent.setup();
		const props = renderForm();

		await user.type(screen.getByLabelText(/event agenda/i), "A");

		expect(props.onAgendaChange).toHaveBeenCalledWith("A");
	});

	it("submits the form", async () => {
		const user = userEvent.setup();
		const props = renderForm({
			agenda: "Plan",
			scheduledAt: "2026-01-01T10:00",
		});

		await user.click(screen.getByRole("button", { name: /schedule event/i }));

		expect(props.onSubmit).toHaveBeenCalledOnce();
	});

	it("disables the submit button and shows progress copy while creating", () => {
		renderForm({ isCreating: true });

		expect(screen.getByRole("button", { name: /scheduling/i })).toBeDisabled();
	});

	it("shows updating copy while an edit is saving", () => {
		renderForm({ isEditing: true, isUpdating: true });

		expect(screen.getByRole("button", { name: /updating/i })).toBeDisabled();
	});
});
