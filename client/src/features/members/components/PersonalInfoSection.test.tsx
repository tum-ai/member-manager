import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { MemberSchema } from "@/lib/schemas";
import { PersonalInfoSection } from "./PersonalInfoSection";

function Harness(
	props: Partial<React.ComponentProps<typeof PersonalInfoSection>> = {},
) {
	const memberForm = useForm<MemberSchema>({
		defaultValues: {
			active: true,
			salutation: "Ms.",
			title: "",
			surname: "Lovelace",
			given_name: "Ada",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "",
			user_id: "user-1",
		},
	});
	return (
		<PersonalInfoSection
			memberForm={memberForm}
			email="ada@tum.ai"
			statusRequestMessage=""
			onStatusChangeRequest={vi.fn()}
			{...props}
		/>
	);
}

describe("PersonalInfoSection", () => {
	it("renders fields, read-only email, and the active badge", () => {
		render(<Harness />);
		expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
		const email = screen.getByLabelText(/email/i);
		expect(email).toHaveValue("ada@tum.ai");
		expect(email).toHaveAttribute("readonly");
		expect(screen.getByText(/active member/i)).toBeInTheDocument();
	});

	it("fires the status change request handler", async () => {
		const userEv = userEvent.setup();
		const onStatusChangeRequest = vi.fn();
		render(<Harness onStatusChangeRequest={onStatusChangeRequest} />);

		await userEv.click(
			screen.getByRole("button", { name: /change your membership status/i }),
		);
		expect(onStatusChangeRequest).toHaveBeenCalled();
	});

	it("shows the status request message when provided", () => {
		render(<Harness statusRequestMessage="Request sent to finance." />);
		expect(screen.getByText(/request sent to finance/i)).toBeInTheDocument();
	});
});
