import { expect, test } from "@playwright/test";
import { loginWithSeedEmail, SEED_LEGAL_FINANCE_MEMBER_EMAIL } from "./helpers";

const FINANCE_ANALYTICS_ROUTE = "/tools/finance/analytics";

test.describe("Finance Analytics tool", () => {
	test.beforeEach(async ({ page }) => {
		await loginWithSeedEmail(page, SEED_LEGAL_FINANCE_MEMBER_EMAIL);
		await page.goto(FINANCE_ANALYTICS_ROUTE);
		await expect(
			page.getByRole("heading", { name: "Finance Analytics" }),
		).toBeVisible();
	});

	test("shows the department overview and assigns an unmapped cost location", async ({
		page,
	}) => {
		// Overview renders the aggregated totals.
		await expect(page.getByText("Einnahmen").first()).toBeVisible();
		await expect(page.getByText("Ausgaben").first()).toBeVisible();

		// Switch to the mapping editor.
		await page.getByRole("tab", { name: "Zuordnung" }).click();
		await expect(
			page.getByRole("columnheader", { name: "Kostenstelle" }),
		).toBeVisible();

		// Pick the first still-unassigned cost location and assign a department.
		// Loading the postings can take a moment against the live API.
		const unassignedRow = page
			.getByRole("row")
			.filter({ hasText: "Nicht zugeordnet" })
			.first();
		await expect(unassignedRow).toBeVisible({ timeout: 20000 });

		// Department is picked from a dropdown, then saved explicitly.
		await unassignedRow
			.getByRole("combobox", { name: /Department für Kostenstelle/ })
			.click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();
		await unassignedRow
			.getByRole("button", { name: /Zuordnung für Kostenstelle .* speichern/ })
			.click();

		await expect(page.getByText("Zuordnung gespeichert.")).toBeVisible();
	});
});
