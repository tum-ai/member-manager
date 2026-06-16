import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./helpers";

test("keeps the session across a reload", async ({ page }) => {
	await loginAsLocalAdmin(page);
	await page.reload();
	await expect(page.getByText("Tools", { exact: true })).toBeVisible();
});

test("navigates to the members directory", async ({ page }) => {
	await loginAsLocalAdmin(page);
	await page.goto("/members");
	await expect(
		page.getByRole("heading", { name: /all members/i }),
	).toBeVisible();
});
