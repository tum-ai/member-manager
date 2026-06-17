import { expect, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// SEPA mandate setup, exercised end-to-end against the real seeded stack as the
// regular member. The profile page is the index route ("/"); the SEPA controls
// live in the "Banking & agreements" panel (SepaPanel), and the mandate text +
// `#sepa-agree` consent checkbox live in the "SEPA Mandate Agreement" modal
// (ProfileAgreementModals → SepaMandate).
//
// Seed note (issue #223): the regular member (00000000-…-0006) has NO seeded
// `sepa` row — SEPA is only seeded for the reimbursement personas (…0001/0009/
// 0011/0020). So GET /api/sepa/<member> 404s and the form renders empty on first
// load. Filling any field makes the SEPA form dirty, which makes the profile
// save include a PUT /api/sepa/<member>. The PUT validates the IBAN server-side
// with `ibantools` (the client only checks length ≥ 15), and a successful save
// upserts the row — so these tests assert via reload rather than a pristine
// empty state, and stay re-runnable.
//
// A valid German IBAN whose check digits pass `isValidIBAN` (matches the seed
// fixtures used elsewhere). Reused deterministically; we assert persistence via
// reload, not against a clean slate.
const VALID_IBAN = "DE89370400440532013000";
const VALID_BIC = "COBADEFFXXX";

// A 15+ char string that clears the client min-length guard but is NOT a valid
// IBAN, so the server PUT rejects it and the save surfaces an error toast.
const INVALID_IBAN = "DE00000000000000";

// The regular member is seeded with all agreements already accepted, so the
// panel checkboxes start CHECKED. Per SepaPanel, unchecking commits `false`
// directly (no modal); only re-checking an UNCHECKED box opens its agreement
// modal. Reset a checkbox to unchecked first so the modal-gating flow is
// exercised deterministically regardless of seed / prior-test state.
async function resetAgreementUnchecked(
	page: Page,
	name: RegExp,
): Promise<void> {
	const checkbox = page.getByRole("checkbox", { name });
	if (await checkbox.isChecked()) {
		await checkbox.click();
		await expect(checkbox).not.toBeChecked();
	}
}

// Opens the three required agreement modals in turn and confirms each, so a
// SEPA save can succeed server-side. The privacy / data-privacy notice modals
// have their own deep coverage in the sibling legal spec (#222); here they are
// driven only as the minimum prerequisite for a real save, while the assertions
// stay focused on the SEPA mandate.
async function agreeAllAgreements(page: Page) {
	// SEPA mandate.
	await resetAgreementUnchecked(page, /SEPA mandate/i);
	await page.getByRole("checkbox", { name: /SEPA mandate/i }).click();
	const sepaDialog = page.getByRole("dialog");
	await expect(sepaDialog.getByText("SEPA Mandate Agreement")).toBeVisible();
	await sepaDialog
		.getByLabel("I have read and agree to the SEPA mandate.")
		.check();
	await sepaDialog.getByRole("button", { name: "Confirm" }).click();
	await expect(sepaDialog).toBeHidden();

	// Privacy policy.
	await resetAgreementUnchecked(page, /Privacy Policy/i);
	await page.getByRole("checkbox", { name: /Privacy Policy/i }).click();
	const privacyDialog = page.getByRole("dialog");
	await privacyDialog.locator("#privacy-agree").check();
	await privacyDialog.getByRole("button", { name: "Confirm" }).click();
	await expect(privacyDialog).toBeHidden();

	// Data privacy notice (all consent items required).
	await resetAgreementUnchecked(page, /Data Privacy Notice/i);
	await page.getByRole("checkbox", { name: /Data Privacy Notice/i }).click();
	const dpnDialog = page.getByRole("dialog");
	await dpnDialog.locator("#consent-websiteProfile").check();
	await dpnDialog.locator("#consent-eventPhotos").check();
	await dpnDialog.locator("#consent-partnerSharing").check();
	await dpnDialog.getByRole("button", { name: "Confirm" }).click();
	await expect(dpnDialog).toBeHidden();
}

test.describe("SEPA mandate setup", () => {
	test("member fills banking details, agrees to the mandate, saves, and the data persists", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		// Banking fields are the labelled inputs inside the "Banking & agreements"
		// panel. IBAN/Bank Name carry a trailing " *" in their label (required),
		// which getByLabel substring-matches.
		await page.getByLabel("IBAN").fill(VALID_IBAN);
		await page.getByLabel("BIC").fill(VALID_BIC);

		// A unique, valid bank name keeps the reload assertion independent of any
		// pre-existing row across reruns.
		const bankName = `Commerzbank E2E ${Date.now()}`;
		await page.getByLabel("Bank Name").fill(bankName);

		// Toggling the mandate checkbox opens the SEPA mandate modal rather than
		// agreeing directly: the consent is gated behind reading the modal.
		await resetAgreementUnchecked(page, /SEPA mandate/i);
		await page.getByRole("checkbox", { name: /SEPA mandate/i }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("SEPA Mandate Agreement")).toBeVisible();

		// Confirm is disabled until the in-modal `#sepa-agree` checkbox is ticked.
		const confirm = dialog.getByRole("button", { name: "Confirm" });
		await expect(confirm).toBeDisabled();

		await dialog
			.getByLabel("I have read and agree to the SEPA mandate.")
			.check();
		await expect(confirm).toBeEnabled();

		await confirm.click();
		await expect(dialog).toBeHidden();

		// The panel's mandate checkbox now reflects the agreed state.
		await expect(
			page.getByRole("checkbox", { name: /SEPA mandate/i }),
		).toBeChecked();

		// The remaining required agreements (privacy + data-privacy notice) must
		// also be satisfied for the SEPA save to pass server-side. Drive them
		// minimally (their deep coverage lives in the legal spec).
		await resetAgreementUnchecked(page, /Privacy Policy/i);
		await page.getByRole("checkbox", { name: /Privacy Policy/i }).click();
		const privacyDialog = page.getByRole("dialog");
		await privacyDialog.locator("#privacy-agree").check();
		await privacyDialog.getByRole("button", { name: "Confirm" }).click();
		await expect(privacyDialog).toBeHidden();

		await resetAgreementUnchecked(page, /Data Privacy Notice/i);
		await page.getByRole("checkbox", { name: /Data Privacy Notice/i }).click();
		const dpnDialog = page.getByRole("dialog");
		await dpnDialog.locator("#consent-websiteProfile").check();
		await dpnDialog.locator("#consent-eventPhotos").check();
		await dpnDialog.locator("#consent-partnerSharing").check();
		await dpnDialog.getByRole("button", { name: "Confirm" }).click();
		await expect(dpnDialog).toBeHidden();

		// Save the profile and wait on the actual SEPA PUT so the assertion does
		// not race the network. The member save fires a member PUT + a sepa PUT.
		const sepaSaved = page.waitForResponse(
			(r) =>
				r.url().includes("/api/sepa/") &&
				r.request().method() === "PUT" &&
				r.ok(),
		);
		await page
			.getByRole("button", { name: /save changes/i })
			.first()
			.click();
		await sepaSaved;
		await expectToast(page, /profile saved successfully/i);

		// Reload to prove the values + mandate state were written server-side.
		await page.reload();
		await expect(page.getByLabel("IBAN")).toHaveValue(VALID_IBAN);
		await expect(page.getByLabel("BIC")).toHaveValue(VALID_BIC);
		await expect(page.getByLabel("Bank Name")).toHaveValue(bankName);
		await expect(
			page.getByRole("checkbox", { name: /SEPA mandate/i }),
		).toBeChecked();
	});

	test("mandate cannot be agreed without opening and confirming the modal", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		const mandateCheckbox = page.getByRole("checkbox", {
			name: /SEPA mandate/i,
		});
		// The seeded member starts agreed; normalise to unchecked first (this
		// commits `false` directly, no modal) so the open-on-check flow is tested.
		await resetAgreementUnchecked(page, /SEPA mandate/i);
		await expect(mandateCheckbox).not.toBeChecked();

		// Clicking the checkbox opens the modal instead of immediately checking it.
		await mandateCheckbox.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("SEPA Mandate Agreement")).toBeVisible();

		// Dismissing the modal without confirming leaves the mandate un-agreed.
		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toBeHidden();
		await expect(mandateCheckbox).not.toBeChecked();

		// Re-open, tick the inner checkbox but cancel: still not agreed, because
		// agreement only commits on Confirm.
		await mandateCheckbox.click();
		const dialog2 = page.getByRole("dialog");
		await dialog2
			.getByLabel("I have read and agree to the SEPA mandate.")
			.check();
		await dialog2.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog2).toBeHidden();
		await expect(mandateCheckbox).not.toBeChecked();
	});

	test("an invalid IBAN is rejected by the server and the save fails", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		// 16 chars clears the client min-length(15) guard but fails the server's
		// `isValidIBAN` check digit validation.
		await page.getByLabel("IBAN").fill(INVALID_IBAN);
		await page.getByLabel("BIC").fill(VALID_BIC);
		await page.getByLabel("Bank Name").fill(`Bad IBAN Bank ${Date.now()}`);

		// Satisfy all three agreements so the request actually reaches the server
		// (otherwise the client blocks on missing agreements, not the IBAN).
		await agreeAllAgreements(page);

		// The save fires a SEPA PUT that the server rejects with a 4xx.
		const sepaRejected = page.waitForResponse(
			(r) =>
				r.url().includes("/api/sepa/") &&
				r.request().method() === "PUT" &&
				r.status() >= 400,
		);
		await page
			.getByRole("button", { name: /save changes/i })
			.first()
			.click();
		await sepaRejected;

		// The page surfaces the failure as an error toast and does NOT claim
		// success.
		await expectToast(page, /Error saving/i);
		await expect(page.getByText(/profile saved successfully/i)).toHaveCount(0);
	});

	test("the SEPA panel renders on the profile page", async ({ page }) => {
		await loginAsLocalMember(page);

		// The panel heading and its three banking fields are present for every
		// member, regardless of whether a SEPA row was seeded.
		await expect(
			page.getByRole("heading", { name: "Banking & agreements" }),
		).toBeVisible();
		await expect(page.getByLabel("IBAN")).toBeVisible();
		await expect(page.getByLabel("BIC")).toBeVisible();
		await expect(page.getByLabel("Bank Name")).toBeVisible();
		await expect(
			page.getByRole("checkbox", { name: /SEPA mandate/i }),
		).toBeVisible();
	});
});
