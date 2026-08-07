import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./helpers";

// Exercises the contract creation form's two per-contract switches against the
// live preview. Read-only: nothing is submitted, so this spec is safe to re-run
// against the same database.

const VAT_SENTENCE = /Umsatzsteuer in Höhe von 19 %/;

test.describe("contract creation form", () => {
	test("reverse charge removes the VAT sentence from the preview", async ({
		page,
	}) => {
		await loginAsLocalAdmin(page);
		await page.goto("/contracts");
		await expect(
			page.getByRole("heading", { name: "Create Contract" }),
		).toBeVisible();

		const preview = page.locator("[data-contract-preview]");
		await expect(preview.getByText(VAT_SENTENCE).first()).toBeVisible();

		await page
			.getByRole("checkbox", { name: "Subject to reverse charge Verfahren?" })
			.click();

		await expect(preview.getByText(VAT_SENTENCE)).toHaveCount(0);
	});

	test("English is offered only for translated templates", async ({ page }) => {
		await loginAsLocalAdmin(page);
		await page.goto("/contracts");

		await expect(page.getByRole("radio", { name: "Deutsch" })).toBeVisible();
		// No template carries an English body yet, so the option stays disabled.
		await expect(page.getByRole("radio", { name: "English" })).toBeDisabled();
	});
});
