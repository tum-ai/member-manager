import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

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
