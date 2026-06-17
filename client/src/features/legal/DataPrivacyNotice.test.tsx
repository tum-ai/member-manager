import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataPrivacyNotice } from "./DataPrivacyNotice";

describe("DataPrivacyNotice", () => {
	it("renders the three separate consent declarations", () => {
		render(<DataPrivacyNotice dataPrivacyNoticeAgreed={false} />);

		const checkboxes = screen.getAllByRole("checkbox");
		expect(checkboxes).toHaveLength(3);
		expect(
			screen.getByRole("heading", { name: /declaration of consent/i }),
		).toBeInTheDocument();
	});

	it("starts with every consent item checked when already agreed", () => {
		render(<DataPrivacyNotice dataPrivacyNoticeAgreed={true} />);

		for (const checkbox of screen.getAllByRole("checkbox")) {
			expect(checkbox).toBeChecked();
		}
	});

	it("only reports full consent once all three items are checked", async () => {
		const user = userEvent.setup();
		const onCheckChange = vi.fn();
		render(
			<DataPrivacyNotice
				dataPrivacyNoticeAgreed={false}
				onCheckChange={onCheckChange}
			/>,
		);

		expect(onCheckChange).toHaveBeenLastCalledWith(false);

		const checkboxes = screen.getAllByRole("checkbox");
		await user.click(checkboxes[0]);
		await user.click(checkboxes[1]);
		// Two of three checked — still not fully consented.
		expect(onCheckChange).toHaveBeenLastCalledWith(false);

		await user.click(checkboxes[2]);
		expect(onCheckChange).toHaveBeenLastCalledWith(true);
	});

	it("drops back to incomplete consent when an item is unchecked", async () => {
		const user = userEvent.setup();
		const onCheckChange = vi.fn();
		render(
			<DataPrivacyNotice
				dataPrivacyNoticeAgreed={true}
				onCheckChange={onCheckChange}
			/>,
		);

		expect(onCheckChange).toHaveBeenLastCalledWith(true);

		await user.click(screen.getAllByRole("checkbox")[0]);

		expect(onCheckChange).toHaveBeenLastCalledWith(false);
	});
});
