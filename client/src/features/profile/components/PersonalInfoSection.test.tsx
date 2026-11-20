import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfileFormHarness } from "@/features/profile/test/ProfileFormHarness";
import { PersonalInfoSection } from "./PersonalInfoSection";

const ids = {
	salutation: "salutation",
	title: "title",
	givenName: "given-name",
	surname: "surname",
	email: "email",
	dob: "dob",
	street: "street",
	number: "number",
	postalCode: "postal-code",
	city: "city",
	country: "country",
};

function Harness({
	suggestedFields,
}: {
	suggestedFields?: React.ComponentProps<
		typeof PersonalInfoSection
	>["suggestedFields"];
}) {
	return (
		<ProfileFormHarness values={{ country: "" }}>
			<PersonalInfoSection
				email="alice@example.com"
				suggestedFields={suggestedFields}
				ids={ids}
			/>
		</ProfileFormHarness>
	);
}

describe("PersonalInfoSection", () => {
	it("renders the personal info fields", () => {
		render(<Harness />);

		expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
	});

	it("shows the read-only email from props", () => {
		render(<Harness />);

		const email = screen.getByLabelText(/email/i);
		expect(email).toHaveValue("alice@example.com");
		expect(email).toBeDisabled();
	});

	it("registers typed input on a registered field", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const firstName = screen.getByLabelText(/first name/i);
		await user.type(firstName, "Alice");

		expect(firstName).toHaveValue("Alice");
	});

	it("lets the user pick a salutation", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await user.click(screen.getByLabelText(/salutation/i));
		await user.click(await screen.findByRole("option", { name: "Ms." }));

		expect(screen.getByLabelText(/salutation/i)).toHaveTextContent("Ms.");
	});
});
