import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// Agreement / privacy acceptance flow (issue #222).
//
// The profile page ("/") renders a "Banking & agreements" panel (SepaPanel)
// whose three consent checkboxes each launch a modal: SEPA Mandate, Privacy
// Policy and Data Privacy Notice. Each modal gates its Confirm button on a
// consent checkbox, and the accepted state is persisted via PUT /api/sepa/:id
// (legacy `sepa` columns + the `member_agreements` table). This spec covers the
// PRIVACY and DATA-PRIVACY legal consent modals only; the IBAN/SEPA banking +
// mandate flow is covered by a sibling spec (#223).
//
// Seed note: the local "regular-member" account is seeded with all three
// agreements ALREADY true (see supabase/seed.sql — the broad member_agreements
// insert sets sepa_mandate_agreed / privacy_policy_agreed /
// data_privacy_notice_agreed to true for every member, and GET /api/sepa merges
// member_agreements over the legacy sepa columns). There is therefore no
// pre-seeded "un-agreed" fixture to lean on. To exercise the ACCEPTANCE flow we
// drive it from the panel itself: unchecking a panel checkbox writes the form
// value to false WITHOUT a modal, then re-checking re-opens the modal so we can
// assert the Confirm gating and re-accept. This keeps the spec independent of
// the seeded boolean and re-runs deterministically.

// The panel checkbox ids are generated via React `useId` (e.g. ":r3:-privacy"),
// so target them by their accessible label rather than a brittle id. Each panel
// label reads "I agree to the <Name>" with the link text matching <Name>.
const PANEL_PRIVACY_LABEL = /I agree to the\s+Privacy Policy/i;
const PANEL_DATA_PRIVACY_LABEL = /I agree to the\s+Data Privacy Notice/i;

// Returns the SepaPanel consent checkbox (a shadcn Checkbox -> role "checkbox")
// whose accessible name matches the panel label.
function panelCheckbox(page: Page, name: RegExp): Locator {
	return page.getByRole("checkbox", { name });
}

// Saves the profile (the SEPA/agreements save) and waits on the PUT /api/sepa
// network call so the assertion reflects server-side persistence, not just form
// state. The "Save Changes" button exists twice (sidebar + mobile); the first
// visible one submits the same form.
async function saveProfile(page: Page): Promise<void> {
	const saved = page.waitForResponse(
		(response) =>
			response.url().includes("/api/sepa/") &&
			response.request().method() === "PUT",
	);
	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();
	await saved;
	await expectToast(page, /profile saved successfully/i);
}

test.describe("legal agreement acceptance flow", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsLocalMember(page);
		// The profile page is the index route. The banking/agreements panel is the
		// anchor for everything below.
		await expect(
			page.getByRole("heading", { name: "Banking & agreements" }),
		).toBeVisible();
	});

	test("Privacy Policy modal gates Confirm on the consent checkbox", async ({
		page,
	}) => {
		const panelPrivacy = panelCheckbox(page, PANEL_PRIVACY_LABEL);

		// Seed leaves this checked. Uncheck it (no modal — writes form value false)
		// to drive the acceptance flow from a clean, un-agreed state.
		if (await panelPrivacy.isChecked()) {
			await panelPrivacy.click();
		}
		await expect(panelPrivacy).not.toBeChecked();

		// Re-checking the panel checkbox opens the Privacy Policy modal.
		await panelPrivacy.click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Privacy Policy Agreement" }),
		).toBeVisible();

		// The legal content heading renders inside the modal body.
		await expect(
			dialog.getByRole("heading", {
				name: "TUM.ai Privacy Policy / Data Agreement",
			}),
		).toBeVisible();

		const confirm = dialog.getByRole("button", { name: "Confirm" });
		const agree = dialog.getByRole("checkbox", {
			name: "I have read and agree to the Privacy Policy.",
		});

		// Confirm is disabled until the consent checkbox is ticked.
		await expect(agree).not.toBeChecked();
		await expect(confirm).toBeDisabled();

		await agree.check();
		await expect(agree).toBeChecked();
		await expect(confirm).toBeEnabled();

		// Confirming closes the modal and reflects the agreement on the panel.
		await confirm.click();
		await expect(dialog).toBeHidden();
		await expect(panelCheckbox(page, PANEL_PRIVACY_LABEL)).toBeChecked();
	});

	test("Data Privacy Notice modal requires every consent before Confirm enables", async ({
		page,
	}) => {
		const panelDataPrivacy = panelCheckbox(page, PANEL_DATA_PRIVACY_LABEL);

		if (await panelDataPrivacy.isChecked()) {
			await panelDataPrivacy.click();
		}
		await expect(panelDataPrivacy).not.toBeChecked();

		await panelDataPrivacy.click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Data Privacy Notice Agreement" }),
		).toBeVisible();
		await expect(
			dialog.getByRole("heading", { name: "Data Privacy Notice", exact: true }),
		).toBeVisible();

		const confirm = dialog.getByRole("button", { name: "Confirm" });
		const websiteProfile = dialog.locator("#consent-websiteProfile");
		const eventPhotos = dialog.locator("#consent-eventPhotos");
		const partnerSharing = dialog.locator("#consent-partnerSharing");

		// All three consents start unchecked (we drove the panel to false) and
		// Confirm stays disabled until the LAST one is checked.
		await expect(websiteProfile).not.toBeChecked();
		await expect(eventPhotos).not.toBeChecked();
		await expect(partnerSharing).not.toBeChecked();
		await expect(confirm).toBeDisabled();

		await websiteProfile.check();
		await expect(confirm).toBeDisabled();

		await eventPhotos.check();
		await expect(confirm).toBeDisabled();

		await partnerSharing.check();
		await expect(confirm).toBeEnabled();

		await confirm.click();
		await expect(dialog).toBeHidden();
		await expect(panelCheckbox(page, PANEL_DATA_PRIVACY_LABEL)).toBeChecked();
	});

	test("accepted legal agreements persist across a reload", async ({
		page,
	}) => {
		// Reset both legal consents to false via the panel, then re-accept both
		// through their modals so the save writes a known true state regardless of
		// the seeded value.
		const panelPrivacy = panelCheckbox(page, PANEL_PRIVACY_LABEL);
		if (await panelPrivacy.isChecked()) {
			await panelPrivacy.click();
		}
		await panelPrivacy.click();
		let dialog = page.getByRole("dialog");
		await dialog
			.getByRole("checkbox", {
				name: "I have read and agree to the Privacy Policy.",
			})
			.check();
		await dialog.getByRole("button", { name: "Confirm" }).click();
		await expect(dialog).toBeHidden();

		const panelDataPrivacy = panelCheckbox(page, PANEL_DATA_PRIVACY_LABEL);
		if (await panelDataPrivacy.isChecked()) {
			await panelDataPrivacy.click();
		}
		await panelDataPrivacy.click();
		dialog = page.getByRole("dialog");
		await dialog.locator("#consent-websiteProfile").check();
		await dialog.locator("#consent-eventPhotos").check();
		await dialog.locator("#consent-partnerSharing").check();
		await dialog.getByRole("button", { name: "Confirm" }).click();
		await expect(dialog).toBeHidden();

		await expect(panelCheckbox(page, PANEL_PRIVACY_LABEL)).toBeChecked();
		await expect(panelCheckbox(page, PANEL_DATA_PRIVACY_LABEL)).toBeChecked();

		await saveProfile(page);

		// Reload to prove the agreements were written server-side, not just held in
		// form state.
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "Banking & agreements" }),
		).toBeVisible();
		await expect(panelCheckbox(page, PANEL_PRIVACY_LABEL)).toBeChecked();
		await expect(panelCheckbox(page, PANEL_DATA_PRIVACY_LABEL)).toBeChecked();
	});

	test("unchecking a required consent re-disables Confirm", async ({
		page,
	}) => {
		const panelDataPrivacy = panelCheckbox(page, PANEL_DATA_PRIVACY_LABEL);
		if (await panelDataPrivacy.isChecked()) {
			await panelDataPrivacy.click();
		}
		await panelDataPrivacy.click();

		const dialog = page.getByRole("dialog");
		const confirm = dialog.getByRole("button", { name: "Confirm" });
		const websiteProfile = dialog.locator("#consent-websiteProfile");
		const eventPhotos = dialog.locator("#consent-eventPhotos");
		const partnerSharing = dialog.locator("#consent-partnerSharing");

		await websiteProfile.check();
		await eventPhotos.check();
		await partnerSharing.check();
		await expect(confirm).toBeEnabled();

		// Removing any single consent re-disables Confirm (all are required).
		await partnerSharing.uncheck();
		await expect(confirm).toBeDisabled();

		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toBeHidden();
	});

	test("closing the Privacy Policy modal does not persist a change", async ({
		page,
	}) => {
		const panelPrivacy = panelCheckbox(page, PANEL_PRIVACY_LABEL);

		// Drive the panel to an un-agreed state first so a cancelled re-acceptance
		// is observable.
		if (await panelPrivacy.isChecked()) {
			await panelPrivacy.click();
		}
		await expect(panelPrivacy).not.toBeChecked();

		// Open the modal, tick consent, but Cancel instead of Confirm.
		await panelPrivacy.click();
		const dialog = page.getByRole("dialog");
		await dialog
			.getByRole("checkbox", {
				name: "I have read and agree to the Privacy Policy.",
			})
			.check();
		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toBeHidden();

		// Cancelling does not commit the agreement: the panel checkbox stays
		// unchecked.
		await expect(panelCheckbox(page, PANEL_PRIVACY_LABEL)).not.toBeChecked();
	});
});
