import { expect, test } from "@playwright/test";
import {
	expectToast,
	loginAsLocalMember,
	loginWithSeedEmail,
	SEED_NO_BANK_DETAILS_MEMBER_EMAIL,
} from "./helpers";

// Edits a self-service profile field as a regular member and asserts the value
// is persisted across a reload. "Public location" lives in the "LinkedIn &
// location" section and is editable by any member (unlike role/department,
// which are admin-managed).
test("member edits a profile field and the change persists", async ({
	page,
}) => {
	await loginAsLocalMember(page);

	// The profile page is the index route ("/").
	const location = page.getByLabel("Public location");
	await expect(location).toBeVisible();

	// Use a unique value so the assertion is independent of any seeded value and
	// re-runs stay deterministic.
	const nextLocation = `Munich, Germany (${Date.now()})`;
	await location.fill(nextLocation);

	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();
	await expectToast(page, /profile saved successfully/i);

	// Reload to prove the value was written server-side, not just held in form
	// state.
	await page.reload();
	await expect(page.getByLabel("Public location")).toHaveValue(nextLocation);
});

// Issue #304: members could only save their profile after entering bank
// details. The seeded no-bank-details persona has no `sepa` row (it is skipped
// by the catch-all SEPA insert in supabase/seed.sql) but does have stored
// agreements, so this covers both the GET without a SEPA row and a save that
// leaves the banking section untouched.
test("member without bank details saves a degree change", async ({ page }) => {
	await loginWithSeedEmail(page, SEED_NO_BANK_DETAILS_MEMBER_EMAIL);

	await expect(page.getByLabel("IBAN")).toHaveValue("");
	await expect(page.getByLabel("Bank Name")).toHaveValue("");
	// Stored agreements load even though there is no SEPA row.
	await expect(
		page.getByRole("checkbox", { name: /Privacy Policy/i }),
	).toBeChecked();

	// Seeded as a Bachelor; flip between Bachelor and Master so re-runs against
	// an un-reset stack still make a real change.
	const degree = page.getByRole("combobox", { name: "Degree" });
	const nextDegree = (await degree.textContent())?.includes("Master")
		? "Bachelor"
		: "Master";
	await degree.click();
	await page.getByRole("option", { name: nextDegree, exact: true }).click();
	await expect(degree).toContainText(nextDegree);

	let sepaPutCount = 0;
	page.on("request", (request) => {
		if (request.url().includes("/api/sepa/") && request.method() === "PUT") {
			sepaPutCount += 1;
		}
	});
	const memberSaved = page.waitForResponse(
		(response) =>
			response.url().includes("/api/members/") &&
			response.request().method() === "PUT" &&
			response.ok(),
	);
	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();
	await memberSaved;
	await expectToast(page, /profile saved successfully/i);
	// Nothing in the banking section changed, so no SEPA request is sent.
	expect(sepaPutCount).toBe(0);

	await page.reload();
	await expect(page.getByRole("combobox", { name: "Degree" })).toContainText(
		nextDegree,
	);
	await expect(page.getByLabel("IBAN")).toHaveValue("");
});

// Issue #397: salutation and batch were missing after saving, switching to
// another page and coming back, and anything typed but not yet saved vanished
// when the tab lost and regained focus.
test("salutation and batch survive a tab switch, a save and a page change", async ({
	page,
}) => {
	await loginAsLocalMember(page);

	const salutation = page.getByRole("combobox", {
		name: "Salutation (optional)",
	});
	const batch = page.getByRole("combobox", { name: "Batch" });
	await expect(salutation).toBeVisible();

	// Pick values that differ from the current ones, so re-runs against an
	// un-reset stack still make a real change.
	const nextSalutation = (await salutation.textContent())?.includes("Mr.")
		? "Ms."
		: "Mr.";
	const nextBatch = (await batch.textContent())?.includes("WS25")
		? "SS25"
		: "WS25";
	await salutation.click();
	await page.getByRole("option", { name: nextSalutation, exact: true }).click();
	await batch.click();
	await page.getByRole("option", { name: nextBatch, exact: true }).click();

	// The unsaved choices are flagged...
	await expect(
		page.getByRole("status").filter({ hasText: "Unsaved changes" }).first(),
	).toBeVisible();

	// ...and survive the tab being hidden and shown again. supabase-js
	// re-emits SIGNED_IN on `visibilitychange`, which used to reset the form.
	await page.evaluate(() => {
		document.dispatchEvent(new Event("visibilitychange"));
		window.dispatchEvent(new Event("focus"));
	});
	await page.waitForTimeout(500);
	await expect(salutation).toContainText(nextSalutation);
	await expect(batch).toContainText(nextBatch);

	const memberSaved = page.waitForResponse(
		(response) =>
			response.url().includes("/api/members/") &&
			response.request().method() === "PUT" &&
			response.ok(),
	);
	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();
	await memberSaved;
	await expectToast(page, /profile saved successfully/i);
	await expect(page.getByText("Unsaved changes")).toHaveCount(0);

	// Leave the profile through the sidebar and come back, without a reload.
	await page.getByRole("link", { name: "Job Board" }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Job Board" }),
	).toBeVisible();
	await page.getByRole("link", { name: "Profile", exact: true }).click();

	await expect(
		page.getByRole("combobox", { name: "Salutation (optional)" }),
	).toContainText(nextSalutation);
	await expect(page.getByRole("combobox", { name: "Batch" })).toContainText(
		nextBatch,
	);
});
