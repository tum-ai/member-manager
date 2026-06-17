import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoleChangeRequestSection } from "./RoleChangeRequestSection";

function renderSection(
	overrides: Partial<
		React.ComponentProps<typeof RoleChangeRequestSection>
	> = {},
) {
	const props: React.ComponentProps<typeof RoleChangeRequestSection> = {
		requestedRole: "",
		setRequestedRole: vi.fn(),
		requestedDepartment: "",
		setRequestedDepartment: vi.fn(),
		isRequestingAlumniStatus: false,
		setIsRequestingAlumniStatus: vi.fn(),
		changeRequestReason: "",
		setChangeRequestReason: vi.fn(),
		latestMemberChangeRequest: undefined,
		isSubmittingChangeRequest: false,
		onSubmitMemberChangeRequest: vi.fn(),
		ids: {
			requestedRole: "requested-role",
			requestedDepartment: "requested-department",
			alumniCheckbox: "alumni",
			reason: "reason",
		},
		...overrides,
	};
	render(<RoleChangeRequestSection {...props} />);
	return props;
}

describe("RoleChangeRequestSection", () => {
	it("invokes the submit handler when the button is clicked", async () => {
		const user = userEvent.setup();
		const props = renderSection();

		await user.click(screen.getByRole("button", { name: /request changes/i }));

		expect(props.onSubmitMemberChangeRequest).toHaveBeenCalledOnce();
	});

	it("toggles alumni status", async () => {
		const user = userEvent.setup();
		const props = renderSection();

		await user.click(screen.getByLabelText(/request alumni status/i));

		expect(props.setIsRequestingAlumniStatus).toHaveBeenCalledWith(true);
	});

	it("shows the latest change request summary", () => {
		renderSection({
			latestMemberChangeRequest: {
				id: "r1",
				user_id: "user-1",
				status: "approved",
				reason: "Earned it",
				changes: {},
			},
		});

		expect(screen.getByText(/latest request: approved/i)).toBeInTheDocument();
		expect(screen.getByText(/reason: earned it/i)).toBeInTheDocument();
	});

	it("disables the button while submitting", () => {
		renderSection({ isSubmittingChangeRequest: true });
		expect(
			screen.getByRole("button", { name: /submitting request/i }),
		).toBeDisabled();
	});
});
