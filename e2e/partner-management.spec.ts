import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin } from "./helpers";

test("creates, updates, archives, and restores a Partner Portal organization", async ({
	page,
}) => {
	const contractStart = new Date();
	contractStart.setUTCDate(contractStart.getUTCDate() + 1);
	const contractEnd = new Date();
	contractEnd.setUTCFullYear(contractEnd.getUTCFullYear() + 1);

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
	await page
		.getByLabel("Contract start")
		.fill(contractStart.toISOString().slice(0, 10));
	await page
		.getByLabel("Contract end")
		.fill(contractEnd.toISOString().slice(0, 10));
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
		.getByRole("button", { name: "Manage jobs for E2E Robotics GmbH" })
		.first()
		.click();
	await page.getByRole("button", { name: "Add job" }).click();
	await page.getByLabel("Job title").fill("Robotics AI Engineer");
	await page.getByLabel("Location").fill("Munich");
	await page
		.getByLabel("Description")
		.fill(
			"Build and deploy reliable robotics AI systems with our engineering team.",
		);
	await page.getByLabel("Contact name").fill("Taylor Example");
	await page.getByLabel("Contact email").fill("jobs@e2e.test");
	await page.getByRole("button", { name: "Publish job" }).click();
	await expect(page.getByText("Robotics AI Engineer")).toBeVisible();

	await page.getByRole("button", { name: "Edit Robotics AI Engineer" }).click();
	await page.getByLabel("Job title").fill("Senior Robotics AI Engineer");
	await page.getByRole("button", { name: "Save changes" }).click();
	await expect(page.getByText("Senior Robotics AI Engineer")).toBeVisible();

	await page
		.getByRole("button", { name: "Archive Senior Robotics AI Engineer" })
		.click();
	await page.getByRole("button", { name: "Archive job" }).click();
	await expect(page.getByText("No active job postings.")).toBeVisible();
	await page.getByRole("button", { name: "Close" }).click();

	await page
		.getByRole("button", { name: "Archive E2E Robotics GmbH" })
		.first()
		.click();
	await page.getByRole("button", { name: "Archive partner" }).click();
	await page.getByRole("button", { name: /archived partners/i }).click();
	await expect(page.getByText("E2E Robotics GmbH").first()).toBeVisible();
	await expect(page.getByText("Archived").first()).toBeVisible();

	await page
		.getByRole("button", { name: "Restore E2E Robotics GmbH" })
		.first()
		.click();
	await page.getByRole("button", { name: "Restore partner" }).click();
	await expect(page.getByText("Awaiting activation").first()).toBeVisible();
});

test("enforces the single-job account contract", async ({ page }) => {
	await loginAsLocalAdmin(page);
	await page.goto("/tools/partners");

	await page.getByRole("button", { name: "Add partner" }).click();
	await page.getByLabel("Company name").fill("E2E Single Job GmbH");
	await page.getByLabel("Primary contact email").fill("single@e2e.test");
	await page.getByLabel("Partner type").click();
	await page.getByRole("option", { name: "Single job posting" }).click();
	await expect(
		page.getByText("One job posting. CV and event access disabled."),
	).toBeVisible();
	await expect(page.getByLabel("Partnership tier")).toHaveCount(0);
	await page.getByLabel("Contract start").fill("2026-08-01");
	await page.getByLabel("Contract end").fill("2027-07-31");
	await page.getByRole("button", { name: "Create partner" }).click();

	await expect(
		page.getByRole("dialog", { name: "Activation link" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Close" }).click();
	await expect(page.getByText("No package tier").first()).toBeVisible();

	await page
		.getByRole("button", { name: "Manage jobs for E2E Single Job GmbH" })
		.first()
		.click();
	await expect(
		page.getByText("1 job posting | CV access disabled"),
	).toBeVisible();
	await page.getByRole("button", { name: "Add job" }).click();
	await page.getByLabel("Job title").fill("Single Job Role");
	await page.getByLabel("Location").fill("Munich");
	await page
		.getByLabel("Description")
		.fill("Build reliable production AI systems with our engineering team.");
	await page.getByLabel("Contact name").fill("Taylor Example");
	await page.getByLabel("Contact email").fill("single@e2e.test");
	await page.getByRole("button", { name: "Publish job" }).click();

	await expect(page.getByText("Single Job Role")).toBeVisible();
	await expect(page.getByRole("button", { name: "Add job" })).toBeDisabled();
	await page.getByRole("button", { name: "Archive Single Job Role" }).click();
	await page.getByRole("button", { name: "Archive job" }).click();
	await expect(page.getByText("No active job postings.")).toBeVisible();
	await expect(page.getByRole("button", { name: "Add job" })).toBeEnabled();

	await page.getByRole("button", { name: "Add job" }).click();
	await page.getByLabel("Job title").fill("Replacement Job Role");
	await page.getByLabel("Location").fill("Munich");
	await page
		.getByLabel("Description")
		.fill("Build dependable AI products with our engineering team in Munich.");
	await page.getByLabel("Contact name").fill("Taylor Example");
	await page.getByLabel("Contact email").fill("single@e2e.test");
	await page.getByRole("button", { name: "Publish job" }).click();
	await expect(page.getByText("Replacement Job Role")).toBeVisible();
});
