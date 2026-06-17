import { render, screen } from "@testing-library/react";
import { UserRound } from "lucide-react";
import { describe, expect, it } from "vitest";
import { SectionHeading } from "./SectionHeading";

describe("SectionHeading", () => {
	it("renders the title", () => {
		render(<SectionHeading icon={UserRound} title="Personal information" />);

		expect(
			screen.getByRole("heading", { name: "Personal information" }),
		).toBeInTheDocument();
	});

	it("renders the optional description", () => {
		render(
			<SectionHeading
				icon={UserRound}
				title="Personal information"
				description="Your name and contact details."
			/>,
		);

		expect(
			screen.getByText("Your name and contact details."),
		).toBeInTheDocument();
	});

	it("omits the description when not provided", () => {
		render(<SectionHeading icon={UserRound} title="Heading only" />);

		expect(
			screen.queryByText("Your name and contact details."),
		).not.toBeInTheDocument();
	});
});
