import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { SepaSchema } from "@/lib/schemas";
import { ProfileAgreementModals } from "./ProfileAgreementModals";

function Harness(
	overrides: Partial<React.ComponentProps<typeof ProfileAgreementModals>> = {},
) {
	const sepaForm = useForm<SepaSchema>({
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
			user_id: "u1",
		},
	});
	const props: React.ComponentProps<typeof ProfileAgreementModals> = {
		sepaForm,
		showSepaModal: false,
		setShowSepaModal: vi.fn(),
		showPrivacyModal: false,
		setShowPrivacyModal: vi.fn(),
		showDataPrivacyNoticeModal: false,
		setShowDataPrivacyNoticeModal: vi.fn(),
		pendingMandateAgreed: false,
		setPendingMandateAgreed: vi.fn(),
		pendingPrivacyAgreed: false,
		setPendingPrivacyAgreed: vi.fn(),
		pendingDataPrivacyNoticeAgreed: false,
		setPendingDataPrivacyNoticeAgreed: vi.fn(),
		...overrides,
	};
	return <ProfileAgreementModals {...props} />;
}

describe("ProfileAgreementModals", () => {
	it("renders nothing when no modal is open", () => {
		render(<Harness />);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("shows the SEPA modal with the mandate document when open", () => {
		render(<Harness showSepaModal />);

		expect(
			screen.getByRole("heading", { name: /sepa mandate agreement/i }),
		).toBeInTheDocument();
		expect(screen.getByText("DE49ZZZ00002729637")).toBeInTheDocument();
	});

	it("keeps confirm disabled until the pending mandate is agreed", () => {
		render(<Harness showSepaModal pendingMandateAgreed={false} />);

		expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
	});

	it("confirms the SEPA mandate when pending agreement is set", async () => {
		const user = userEvent.setup();
		const setShowSepaModal = vi.fn();
		render(
			<Harness
				showSepaModal
				pendingMandateAgreed
				setShowSepaModal={setShowSepaModal}
			/>,
		);

		await user.click(screen.getByRole("button", { name: /confirm/i }));

		expect(setShowSepaModal).toHaveBeenCalledWith(false);
	});

	it("shows the privacy modal when open", () => {
		render(<Harness showPrivacyModal />);

		expect(
			screen.getByRole("heading", { name: /privacy policy agreement/i }),
		).toBeInTheDocument();
	});

	it("shows the data-privacy modal when open", () => {
		render(<Harness showDataPrivacyNoticeModal />);

		expect(
			screen.getByRole("heading", { name: /data privacy notice agreement/i }),
		).toBeInTheDocument();
	});
});
