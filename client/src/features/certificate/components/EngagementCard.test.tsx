import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { EngagementFormSchema } from "@/lib/schemas";

import { EngagementCard } from "./EngagementCard";

function Harness({
	canRemove = false,
	onRemove = vi.fn(),
}: {
	canRemove?: boolean;
	onRemove?: (index: number) => void;
}) {
	const form = useForm<EngagementFormSchema>({
		defaultValues: {
			engagements: [
				{
					id: "eng-1",
					startDate: "",
					endDate: "",
					isStillActive: false,
					weeklyHours: "",
					department: "",
					isTeamLead: false,
					specialRole: "",
					tasksDescription: "",
				},
			],
		},
	});
	return (
		<EngagementCard
			form={form}
			index={0}
			canRemove={canRemove}
			onRemove={onRemove}
		/>
	);
}

describe("EngagementCard", () => {
	it("renders the engagement heading and end date field by default", () => {
		render(<Harness />);
		expect(
			screen.getByRole("heading", { name: /engagement #1/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
	});

	it("hides the end date field when still-active is toggled on", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
		await user.click(screen.getByLabelText(/still active/i));
		expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument();
	});

	it("hides the remove button when removal is not allowed", () => {
		render(<Harness canRemove={false} />);
		expect(
			screen.queryByRole("button", { name: /remove engagement/i }),
		).not.toBeInTheDocument();
	});

	it("fires onRemove with the index when remove is clicked", async () => {
		const user = userEvent.setup();
		const onRemove = vi.fn();
		render(<Harness canRemove onRemove={onRemove} />);

		await user.click(
			screen.getByRole("button", { name: /remove engagement 1/i }),
		);
		expect(onRemove).toHaveBeenCalledWith(0);
	});

	it("tracks the task description character count", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await user.type(
			screen.getByLabelText(/tasks \/ responsibilities/i),
			"Hello",
		);
		expect(screen.getByText("5/1000 chars")).toBeInTheDocument();
	});
});
