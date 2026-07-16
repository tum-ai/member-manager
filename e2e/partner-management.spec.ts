import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./helpers";

test("creates, updates, and archives a Partner Portal organization", async ({
	page,
}) => {
	await loginAsLocalAdmin(page);
	await page.goto("/tools/partners");
	await expect(
		page.getByRole("heading", { name: "Partner Management" }),
	).toBeVisible();

	await page.getByRole("button", { name: "Add partner" }).click();
	await page.getByLabel("Company name").fill("E2E Robotics GmbH");
	await page.getByLabel("Primary contact email").fill("partner@e2e.test");
	await page.getByLabel("Partnership tier").click();
	await page.getByRole("option", { name: "Silver" }).click();
	await page.getByLabel("Contract start").fill("2026-08-01");
	await page.getByLabel("Contract end").fill("2027-07-31");
	await page.getByLabel("Website").fill("https://e2e.test");
	await page.getByRole("button", { name: "Create partner" }).click();

	await expect(
		page.getByRole("dialog", { name: "Activation link" }),
	).toBeVisible();
	await expect(
		page.getByText(/email sent to E2E Robotics GmbH/i),
	).toBeVisible();
	await page.getByRole("button", { name: "Close" }).click();

	await expect(page.getByText("E2E Robotics GmbH").first()).toBeVisible();
	await expect(page.getByText("Silver").first()).toBeVisible();

	await page
		.getByRole("button", { name: "Edit E2E Robotics GmbH" })
		.first()
		.click();
	await page.getByLabel("Partnership tier").click();
	await page.getByRole("option", { name: "Gold" }).click();
	await page.getByRole("button", { name: "Save changes" }).click();
	await expect(page.getByText("Gold").first()).toBeVisible();

	await page
		.getByRole("button", { name: "Archive E2E Robotics GmbH" })
		.first()
		.click();
	await page.getByRole("button", { name: "Archive partner" }).click();
	await expect(page.getByText("Archived").first()).toBeVisible();
});
