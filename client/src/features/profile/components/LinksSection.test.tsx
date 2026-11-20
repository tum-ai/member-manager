import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfileFormHarness } from "@/features/profile/test/ProfileFormHarness";
import { LinksSection } from "./LinksSection";

const ids = { linkedinUrl: "linkedin-url", publicLocation: "public-location" };

function Harness({ linkedinUrl = "" }: { linkedinUrl?: string }) {
	return (
		<ProfileFormHarness values={{ linkedin_profile_url: linkedinUrl }}>
			<LinksSection ids={ids} />
		</ProfileFormHarness>
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

	it("shows the profile link only once the url is a valid LinkedIn profile", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		expect(
			screen.queryByRole("link", { name: /view linkedin profile/i }),
		).not.toBeInTheDocument();

		const input = screen.getByLabelText(/linkedin profile url/i);
		await user.type(input, "https://example.com/nope");
		expect(
			screen.queryByRole("link", { name: /view linkedin profile/i }),
		).not.toBeInTheDocument();

		await user.clear(input);
		await user.type(input, "https://linkedin.com/in/alice");
		expect(
			screen.getByRole("link", { name: /view linkedin profile/i }),
		).toHaveAttribute("href", "https://linkedin.com/in/alice");
	});

	it("shows the link for a stored valid url", () => {
		render(<Harness linkedinUrl="https://linkedin.com/in/alice" />);
		expect(
			screen.getByRole("link", { name: /view linkedin profile/i }),
		).toHaveAttribute("href", "https://linkedin.com/in/alice");
	});
});
