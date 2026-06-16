import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./helpers";

test("shows the login screen to anonymous visitors", async ({ page }) => {
	await page.goto("/");
	await expect(
		page.getByRole("button", { name: /continue with slack/i }),
	).toBeVisible();
});

test("logs in as the seeded local admin and reaches the app", async ({
	page,
}) => {
	await loginAsLocalAdmin(page);
	// Auth screen is gone once authenticated.
	await expect(
		page.getByRole("button", { name: /continue with slack/i }),
	).toBeHidden();
});
