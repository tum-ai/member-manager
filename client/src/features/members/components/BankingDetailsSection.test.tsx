import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { SepaSchema } from "@/lib/schemas";
import { BankingDetailsSection } from "./BankingDetailsSection";

function Harness(
	props: Partial<React.ComponentProps<typeof BankingDetailsSection>> = {},
) {
	const sepaForm = useForm<SepaSchema>({
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
			user_id: "user-1",
		},
	});
	return (
		<form>
			<BankingDetailsSection
				sepaForm={sepaForm}
				isUpdating={false}
				onOpenSepaModal={vi.fn()}
				onOpenPrivacyModal={vi.fn()}
				onOpenDataPrivacyNoticeModal={vi.fn()}
				onCancel={vi.fn()}
				{...props}
			/>
		</form>
	);
}

describe("BankingDetailsSection", () => {
	it("renders banking fields", () => {
		render(<Harness />);
		expect(screen.getByLabelText(/iban/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /save changes/i }),
		).toBeInTheDocument();
	});

	it("opens the SEPA modal via its link button", async () => {
		const userEv = userEvent.setup();
		const onOpenSepaModal = vi.fn();
		render(<Harness onOpenSepaModal={onOpenSepaModal} />);

		await userEv.click(screen.getByRole("button", { name: /sepa mandate/i }));
		expect(onOpenSepaModal).toHaveBeenCalled();
	});

	it("opens the privacy modal via its link button", async () => {
		const userEv = userEvent.setup();
		const onOpenPrivacyModal = vi.fn();
		render(<Harness onOpenPrivacyModal={onOpenPrivacyModal} />);

		await userEv.click(screen.getByRole("button", { name: /privacy policy/i }));
		expect(onOpenPrivacyModal).toHaveBeenCalled();
	});

	it("opens the data privacy notice modal when its card is checked", async () => {
		const userEv = userEvent.setup();
		const onOpenDataPrivacyNoticeModal = vi.fn();
		render(
			<Harness onOpenDataPrivacyNoticeModal={onOpenDataPrivacyNoticeModal} />,
		);

		await userEv.click(screen.getAllByRole("checkbox")[2]);
		expect(onOpenDataPrivacyNoticeModal).toHaveBeenCalled();
	});

	it("fires cancel and disables submit while updating", async () => {
		const userEv = userEvent.setup();
		const onCancel = vi.fn();
		render(<Harness isUpdating onCancel={onCancel} />);

		expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
		await userEv.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onCancel).toHaveBeenCalled();
	});
});
