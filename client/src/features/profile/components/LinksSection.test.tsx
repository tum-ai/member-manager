import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { LinkedinSchema } from "@/lib/schemas";
import { LinksSection } from "./LinksSection";

const ids = { linkedinUrl: "linkedin-url", publicLocation: "public-location" };

function Harness({
	isLinkedinUrlValid = false,
	normalizedLinkedinUrl = "",
}: {
	isLinkedinUrlValid?: boolean;
	normalizedLinkedinUrl?: string;
}) {
	const linkedinForm = useForm<LinkedinSchema>({
		defaultValues: { linkedin_profile_url: "", public_location: "" },
	});
	return (
		<LinksSection
			linkedinForm={linkedinForm}
			isLinkedinUrlValid={isLinkedinUrlValid}
			normalizedLinkedinUrl={normalizedLinkedinUrl}
			ids={ids}
		/>
	);
}

describe("LinksSection", () => {
	it("renders the linkedin and location inputs", () => {
		render(<Harness />);

		expect(screen.getByLabelText(/linkedin profile url/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/public location/i)).toBeInTheDocument();
	});

	it("accepts typing into the linkedin field", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const input = screen.getByLabelText(/linkedin profile url/i);
		await user.type(input, "https://linkedin.com/in/alice");

		expect(input).toHaveValue("https://linkedin.com/in/alice");
	});

	it("shows the profile link only when the url is valid", () => {
		const { rerender } = render(<Harness />);
		expect(
			screen.queryByRole("link", { name: /view linkedin profile/i }),
		).not.toBeInTheDocument();

		rerender(
			<Harness
				isLinkedinUrlValid
				normalizedLinkedinUrl="https://linkedin.com/in/alice"
			/>,
		);
		expect(
			screen.getByRole("link", { name: /view linkedin profile/i }),
		).toHaveAttribute("href", "https://linkedin.com/in/alice");
	});
});
