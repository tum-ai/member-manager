import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { SepaSchema } from "../../../lib/schemas";
import { SepaPanel } from "./SepaPanel";

const ids = {
	iban: "iban",
	bic: "bic",
	bankName: "bank-name",
	mandate: "mandate",
	privacy: "privacy",
	dataPrivacy: "data-privacy",
};

function Harness({
	mandateAgreed = false,
	privacyAgreed = false,
	dataPrivacyNoticeAgreed = false,
	openSepaModal = vi.fn(),
	openPrivacyModal = vi.fn(),
	openDataPrivacyNoticeModal = vi.fn(),
}: Partial<React.ComponentProps<typeof SepaPanel>>) {
	const sepaForm = useForm<SepaSchema>({
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: mandateAgreed,
			privacy_agreed: privacyAgreed,
			data_privacy_notice_agreed: dataPrivacyNoticeAgreed,
			user_id: "u1",
		},
	});
	return (
		<SepaPanel
			sepaForm={sepaForm}
			mandateAgreed={mandateAgreed}
			privacyAgreed={privacyAgreed}
			dataPrivacyNoticeAgreed={dataPrivacyNoticeAgreed}
			openSepaModal={openSepaModal}
			openPrivacyModal={openPrivacyModal}
			openDataPrivacyNoticeModal={openDataPrivacyNoticeModal}
			ids={ids}
		/>
	);
}

describe("SepaPanel", () => {
	it("renders the banking fields", () => {
		render(<Harness />);

		expect(screen.getByLabelText(/iban/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^bic$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
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

	it("opens the privacy and data-privacy modals", async () => {
		const user = userEvent.setup();
		const openPrivacyModal = vi.fn();
		const openDataPrivacyNoticeModal = vi.fn();
		render(
			<Harness
				openPrivacyModal={openPrivacyModal}
				openDataPrivacyNoticeModal={openDataPrivacyNoticeModal}
			/>,
		);

		await user.click(screen.getByRole("checkbox", { name: /privacy policy/i }));
		expect(openPrivacyModal).toHaveBeenCalledOnce();

		await user.click(
			screen.getByRole("checkbox", { name: /data privacy notice/i }),
		);
		expect(openDataPrivacyNoticeModal).toHaveBeenCalledOnce();
	});

	it("renders checked agreement boxes when already agreed", () => {
		render(<Harness mandateAgreed privacyAgreed dataPrivacyNoticeAgreed />);

		for (const checkbox of screen.getAllByRole("checkbox")) {
			expect(checkbox).toBeChecked();
		}
	});
});
