import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { MemberSchema } from "@/lib/schemas";
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

function Harness() {
	const memberForm = useForm<MemberSchema>({
		defaultValues: {
			active: true,
			salutation: "",
			given_name: "",
			surname: "",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "",
		} as Partial<MemberSchema> as MemberSchema,
	});
	return (
		<PersonalInfoSection
			memberForm={memberForm}
			email="alice@example.com"
			ids={ids}
		/>
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
