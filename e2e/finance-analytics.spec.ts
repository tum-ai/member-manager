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

	test("shows the category breakdown and labels a second cost location", async ({
		page,
	}) => {
		// Category breakdown tab renders the by-category table.
		await page.getByRole("tab", { name: "Kategorien" }).click();
		await expect(page.getByText("Ausgaben pro Kategorie")).toBeVisible();

		// The category editor lives under the mapping tab, below the department one.
		await page.getByRole("tab", { name: "Zuordnung" }).click();
		await expect(
			page.getByRole("columnheader", { name: "Kostenstelle 2" }),
		).toBeVisible();

		const unlabelledInput = page
			.getByRole("textbox", { name: /Kategorie für Kostenstelle 2/ })
			.first();
		await expect(unlabelledInput).toBeVisible({ timeout: 20000 });
		await unlabelledInput.fill("Catering");
		await unlabelledInput.blur();

		await expect(page.getByText("Kategorie gespeichert.")).toBeVisible();
	});

	test("shows the account breakdown and labels a ledger account", async ({
		page,
	}) => {
		// Accounts breakdown tab renders the by-account table.
		await page.getByRole("tab", { name: "Konten" }).click();
		await expect(page.getByText("Ausgaben pro Konto")).toBeVisible();

		// The account editor lives under the mapping tab, below the others.
		await page.getByRole("tab", { name: "Zuordnung" }).click();
		await expect(
			page.getByRole("columnheader", { name: "Konto", exact: true }),
		).toBeVisible();

		const unlabelledInput = page
			.getByRole("textbox", { name: /Bezeichnung für Konto/ })
			.first();
		await expect(unlabelledInput).toBeVisible({ timeout: 20000 });
		await unlabelledInput.fill("Software & Tools");
		await unlabelledInput.blur();

		await expect(page.getByText("Konto gespeichert.")).toBeVisible();
	});
});
