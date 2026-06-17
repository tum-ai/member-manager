import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataPrivacyNotice } from "./DataPrivacyNotice";

const consentNames = {
	websiteProfile: /displaying my full name, photo, course of studies/i,
	eventPhotos: /publishing photos of me taken in the context/i,
	partnerSharing: /sharing my data \(including cv, photo/i,
} as const;

const getConsentCheckbox = (key: keyof typeof consentNames) =>
	screen.getByRole("checkbox", { name: consentNames[key] });

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

		await user.click(getConsentCheckbox("websiteProfile"));
		await user.click(getConsentCheckbox("eventPhotos"));
		// Two of three checked — still not fully consented.
		expect(onCheckChange).toHaveBeenLastCalledWith(false);

		await user.click(getConsentCheckbox("partnerSharing"));
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

		await user.click(getConsentCheckbox("websiteProfile"));

		expect(onCheckChange).toHaveBeenLastCalledWith(false);
	});

	it("toggles each consent checkbox independently", async () => {
		const user = userEvent.setup();
		render(<DataPrivacyNotice dataPrivacyNoticeAgreed={false} />);

		const websiteProfile = getConsentCheckbox("websiteProfile");
		const eventPhotos = getConsentCheckbox("eventPhotos");
		const partnerSharing = getConsentCheckbox("partnerSharing");

		await user.click(websiteProfile);
		expect(websiteProfile).toBeChecked();
		expect(eventPhotos).not.toBeChecked();
		expect(partnerSharing).not.toBeChecked();

		await user.click(partnerSharing);
		expect(websiteProfile).toBeChecked();
		expect(eventPhotos).not.toBeChecked();
		expect(partnerSharing).toBeChecked();

		await user.click(websiteProfile);
		expect(websiteProfile).not.toBeChecked();
		expect(eventPhotos).not.toBeChecked();
		expect(partnerSharing).toBeChecked();
	});

	it("never reports full consent while any item stays unchecked", async () => {
		const user = userEvent.setup();
		const onCheckChange = vi.fn();
		render(
			<DataPrivacyNotice
				dataPrivacyNoticeAgreed={false}
				onCheckChange={onCheckChange}
			/>,
		);

		// `allChecked` stays false across both clicks, so the effect never
		// re-fires after its initial `false` — the callback must keep that value.
		await user.click(getConsentCheckbox("websiteProfile"));
		await user.click(getConsentCheckbox("eventPhotos"));

		expect(onCheckChange).not.toHaveBeenCalledWith(true);
		expect(onCheckChange).toHaveBeenLastCalledWith(false);
		// Only the initial mount notification fired; partial toggles do not flip
		// `allChecked`, so no further callbacks are emitted.
		expect(onCheckChange).toHaveBeenCalledTimes(1);
	});

	it("round-trips full consent on and back off", async () => {
		const user = userEvent.setup();
		const onCheckChange = vi.fn();
		render(
			<DataPrivacyNotice
				dataPrivacyNoticeAgreed={false}
				onCheckChange={onCheckChange}
			/>,
		);

		await user.click(getConsentCheckbox("websiteProfile"));
		await user.click(getConsentCheckbox("eventPhotos"));
		await user.click(getConsentCheckbox("partnerSharing"));
		expect(onCheckChange).toHaveBeenLastCalledWith(true);

		await user.click(getConsentCheckbox("eventPhotos"));
		expect(onCheckChange).toHaveBeenLastCalledWith(false);
	});
});
