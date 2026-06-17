import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivacyPolicy } from "./PrivacyPolicy";

describe("PrivacyPolicy", () => {
	it("renders the policy heading and consent checkbox", () => {
		render(<PrivacyPolicy privacyAgreed={false} />);

		expect(
			screen.getByRole("heading", { name: /privacy policy/i }),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText(/i have read and agree to the privacy policy/i),
		).toBeInTheDocument();
	});

	it("starts checked when already agreed", () => {
		render(<PrivacyPolicy privacyAgreed={true} />);

		expect(screen.getByRole("checkbox")).toBeChecked();
	});

	it("emits the new checked state when toggled", async () => {
		const user = userEvent.setup();
		const onCheckChange = vi.fn();
		render(
			<PrivacyPolicy privacyAgreed={false} onCheckChange={onCheckChange} />,
		);

		expect(onCheckChange).toHaveBeenLastCalledWith(false);

		await user.click(screen.getByRole("checkbox"));

		expect(onCheckChange).toHaveBeenLastCalledWith(true);
	});

	it("syncs with the agreed prop", () => {
		const { rerender } = render(<PrivacyPolicy privacyAgreed={false} />);
		expect(screen.getByRole("checkbox")).not.toBeChecked();

		rerender(<PrivacyPolicy privacyAgreed={true} />);
		expect(screen.getByRole("checkbox")).toBeChecked();
	});
});
