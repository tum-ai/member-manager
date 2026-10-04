import type { MemberConsents } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSepaInput } from "@/lib/schemas";
import { SepaPanel } from "./SepaPanel";

const ids = {
	iban: "iban",
	bic: "bic",
	bankName: "bank-name",
	mandate: "mandate",
	privacy: "privacy",
};

const partnerOnly: MemberConsents = {
	privacy_policy_agreed: true,
	website_profile_consent: false,
	event_photos_consent: false,
	partner_sharing_consent: true,
	consents_decided_at: "2026-10-01T00:00:00Z",
};

function Harness({
	mandateAgreed = false,
	privacyAgreed = false,
	memberConsents,
	openSepaModal = vi.fn(),
	openPrivacyModal = vi.fn(),
}: Partial<React.ComponentProps<typeof SepaPanel>>) {
	const sepaForm = useForm<ProfileSepaInput>({
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: mandateAgreed,
			privacy_agreed: privacyAgreed,
		},
	});
	return (
		<MemoryRouter>
			<SepaPanel
				sepaForm={sepaForm}
				mandateAgreed={mandateAgreed}
				privacyAgreed={privacyAgreed}
				memberConsents={memberConsents}
				openSepaModal={openSepaModal}
				openPrivacyModal={openPrivacyModal}
				ids={ids}
			/>
		</MemoryRouter>
	);
}

describe("SepaPanel", () => {
	it("renders the banking fields", () => {
		render(<Harness />);

		expect(screen.getByLabelText(/iban/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^bic$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
	});

	it("marks bank details as optional so they never block the profile form", () => {
		render(<Harness />);

		// A native `required` here blocks the whole profile form from
		// submitting, even when the member only edits their degree (#304).
		for (const input of [
			screen.getByLabelText(/iban/i),
			screen.getByLabelText(/^bic$/i),
			screen.getByLabelText(/bank name/i),
		]) {
			expect(input).not.toBeRequired();
		}
		expect(screen.getByText(/bank details are optional/i)).toBeInTheDocument();
	});

	it("opens the SEPA modal when checking the unchecked mandate box", async () => {
		const user = userEvent.setup();
		const openSepaModal = vi.fn();
		render(<Harness openSepaModal={openSepaModal} />);

		await user.click(screen.getByRole("checkbox", { name: /sepa mandate/i }));

		expect(openSepaModal).toHaveBeenCalledOnce();
	});

	it("opens the SEPA modal via the inline link too", async () => {
		const user = userEvent.setup();
		const openSepaModal = vi.fn();
		render(<Harness openSepaModal={openSepaModal} />);

		await user.click(screen.getByRole("button", { name: /^sepa mandate$/i }));

		expect(openSepaModal).toHaveBeenCalled();
	});

	it("opens the privacy modal", async () => {
		const user = userEvent.setup();
		const openPrivacyModal = vi.fn();
		render(<Harness openPrivacyModal={openPrivacyModal} />);

		await user.click(screen.getByRole("checkbox", { name: /privacy policy/i }));
		expect(openPrivacyModal).toHaveBeenCalledOnce();
	});

	it("shows a partial consent decision as it is, with no combined checkbox", () => {
		// Regression (PR #368 review): a partner-only choice used to appear as an
		// unticked "Data Privacy Notice" box that could neither show nor
		// withdraw the partner consent.
		render(<Harness memberConsents={partnerOnly} />);

		expect(
			screen.queryByRole("checkbox", { name: /data privacy notice/i }),
		).not.toBeInTheDocument();
		const row = (name: RegExp) =>
			screen.getByText(name).closest("div")?.textContent ?? "";
		expect(row(/sharing my data and cv/i)).toContain("Agreed");
		expect(row(/website/i)).toContain("Not agreed");
		expect(row(/event photos/i)).toContain("Not agreed");
		expect(
			screen.getByRole("link", { name: "Manage consents" }),
		).toHaveAttribute("href", "/welcome");
	});

	it("asks an undecided member to make their choices", () => {
		render(<Harness />);

		expect(screen.getByText(/haven't made your choices/i)).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Make your choices" }),
		).toHaveAttribute("href", "/welcome");
	});

	it("renders checked agreement boxes when already agreed", () => {
		render(<Harness mandateAgreed privacyAgreed />);

		for (const checkbox of screen.getAllByRole("checkbox")) {
			expect(checkbox).toBeChecked();
		}
	});
});
