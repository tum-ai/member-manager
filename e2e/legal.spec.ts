import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// Agreement / privacy acceptance flow (issue #222).
//
// The profile page ("/") renders a "Banking & agreements" panel (SepaPanel)
// whose SEPA Mandate and Privacy Policy checkboxes each launch a modal that
// gates its Confirm button on a consent checkbox; the accepted state is
// persisted via PUT /api/sepa/:id (legacy `sepa` columns + the
// `member_agreements` table). The Data Privacy Notice purposes are shown there
// read-only and edited per purpose on /welcome. This spec covers the Privacy
// Policy modal and the Data Privacy Notice consents; the IBAN/SEPA banking +
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

// Saves a Data Privacy Notice decision on /welcome: Privacy Policy agreed,
// website and photos refused, partner sharing as given.
async function saveConsentsOnWelcome(
	page: Page,
	{ partnerSharing }: { partnerSharing: boolean },
): Promise<void> {
	if (!page.url().endsWith("/welcome")) {
		await page.goto("/welcome");
	}
	await page
		.getByRole("checkbox", {
			name: /read and understood the TUM\.ai Privacy Policy/i,
		})
		.setChecked(true);
	await page
		.getByRole("checkbox", { name: /displaying my full name/i })
		.setChecked(false);
	await page
		.getByRole("checkbox", { name: /publishing photos/i })
		.setChecked(false);
	await page
		.getByRole("checkbox", { name: /sharing my data/i })
		.setChecked(partnerSharing);

	const saved = page.waitForResponse(
		(response) =>
			/\/api\/members\/[^/]+\/consents$/.test(response.url()) &&
			response.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Save my choices" }).click();
	expect((await saved).status()).toBe(200);
}

// Asserts the read-only consent summary on the profile's agreements panel.
async function expectConsentSummary(
	page: Page,
	expected: { website: string; photos: string; partner: string },
): Promise<void> {
	const summary = page.getByRole("region", {
		name: "Data Privacy Notice consents",
	});
	const answer = (purpose: RegExp) =>
		summary.locator("div").filter({ hasText: purpose }).locator("dd");
	await expect(answer(/website/i)).toHaveText(expected.website);
	await expect(answer(/event photos/i)).toHaveText(expected.photos);
	await expect(answer(/partners/i)).toHaveText(expected.partner);
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
		const dialog = page.getByRole("dialog");
		await dialog
			.getByRole("checkbox", {
				name: "I have read and agree to the Privacy Policy.",
			})
			.check();
		await dialog.getByRole("button", { name: "Confirm" }).click();
		await expect(dialog).toBeHidden();

		await expect(panelCheckbox(page, PANEL_PRIVACY_LABEL)).toBeChecked();

		await saveProfile(page);

		// Reload to prove the agreements were written server-side, not just held in
		// form state.
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "Banking & agreements" }),
		).toBeVisible();
		await expect(panelCheckbox(page, PANEL_PRIVACY_LABEL)).toBeChecked();
	});

	test("a partner-only consent shows on the profile and can be withdrawn on its own", async ({
		page,
	}) => {
		// Regression (review on #368): the profile used to show a partial choice
		// as an unticked combined checkbox that could neither show nor withdraw
		// the partner consent.
		await expect(
			page.getByRole("checkbox", { name: /Data Privacy Notice/i }),
		).toHaveCount(0);

		await saveConsentsOnWelcome(page, { partnerSharing: true });
		await page
			.getByRole("button", { name: "Continue to your profile" })
			.click();
		await expectConsentSummary(page, {
			website: "Not agreed",
			photos: "Not agreed",
			partner: "Agreed",
		});

		await page.getByRole("link", { name: "Manage consents" }).click();
		await expect(page).toHaveURL(/\/welcome$/);
		await saveConsentsOnWelcome(page, { partnerSharing: false });
		await page
			.getByRole("button", { name: "Continue to your profile" })
			.click();
		await expectConsentSummary(page, {
			website: "Not agreed",
			photos: "Not agreed",
			partner: "Not agreed",
		});
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
