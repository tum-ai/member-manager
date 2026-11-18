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

// Issue #397: salutation and batch were cleared after leaving the page and
// coming back, even when the PUT had persisted them.
test("saved salutation and batch survive a page change (#397)", async ({
	page,
}) => {
	await loginAsLocalMember(page);

	const salutation = page.getByRole("combobox", {
		name: /salutation \(optional\)/i,
	});
	await salutation.click();
	await page.getByRole("option", { name: "Ms.", exact: true }).click();
	await expect(salutation).toContainText("Ms.");

	const batch = page.getByRole("combobox", { name: /^batch$/i });
	await batch.click();
	await page.getByRole("option", { name: "SS25", exact: true }).click();
	await expect(batch).toContainText("SS25");

	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();
	await expectToast(page, /profile saved successfully/i);

	await page.getByRole("link", { name: /job board/i }).click();
	await expect(page).toHaveURL(/\/tools\/jobs/);

	await page
		.getByRole("link", { name: /profile/i })
		.first()
		.click();
	await expect(page).toHaveURL(/\/$/);
	await expect(
		page.getByRole("combobox", { name: /salutation \(optional\)/i }),
	).toContainText("Ms.");
	await expect(page.getByRole("combobox", { name: /^batch$/i })).toContainText(
		"SS25",
	);
});

// Refocus does not clear unsaved field values (Supabase auth + query refetch).
test("unsaved profile edits survive a browser tab refocus", async ({
	page,
}) => {
	await loginAsLocalMember(page);

	const location = page.getByLabel("Public location");
	await expect(location).toBeVisible();
	const nextLocation = `After refocus (${Date.now()})`;
	await location.fill(nextLocation);
	await expect(page.getByRole("status").first()).toContainText(
		/unsaved changes/i,
	);

	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		document.dispatchEvent(new Event("visibilitychange"));
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "visible",
		});
		document.dispatchEvent(new Event("visibilitychange"));
	});

	await expect(page.getByLabel("Public location")).toHaveValue(nextLocation);
	await expect(page.getByRole("status").first()).toContainText(
		/unsaved changes/i,
	);
});
