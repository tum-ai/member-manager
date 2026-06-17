import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SepaMandate } from "./SepaMandate";

describe("SepaMandate", () => {
	it("renders the creditor identifier and mandate copy", () => {
		render(<SepaMandate sepaAgreed={false} />);

		expect(screen.getByText("DE49ZZZ00002729637")).toBeInTheDocument();
		expect(
			screen.getByText(/i have read and agree to the sepa mandate/i),
		).toBeInTheDocument();
	});

	it("reflects the initial agreed state on the checkbox", () => {
		render(<SepaMandate sepaAgreed={true} />);

		expect(screen.getByRole("checkbox")).toBeChecked();
	});

	it("notifies the parent when the checkbox is toggled", async () => {
		const user = userEvent.setup();
		const onCheckChange = vi.fn();
		render(<SepaMandate sepaAgreed={false} onCheckChange={onCheckChange} />);

		// Initial effect fires with the starting (false) value.
		expect(onCheckChange).toHaveBeenLastCalledWith(false);

		await user.click(screen.getByRole("checkbox"));

		expect(onCheckChange).toHaveBeenLastCalledWith(true);
	});

	it("syncs the checkbox when the agreed prop changes", () => {
		const { rerender } = render(<SepaMandate sepaAgreed={false} />);
		expect(screen.getByRole("checkbox")).not.toBeChecked();

		rerender(<SepaMandate sepaAgreed={true} />);
		expect(screen.getByRole("checkbox")).toBeChecked();
	});
});
