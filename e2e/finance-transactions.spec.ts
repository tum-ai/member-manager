import { expect, test } from "@playwright/test";
import { loginWithSeedEmail, SEED_LEGAL_FINANCE_MEMBER_EMAIL } from "./helpers";

const FINANCE_TRANSACTIONS_ROUTE = "/tools/finance/buchhaltungsbutler";
const FINANCE_2026_FROM = "2026-01-01";
const FINANCE_2026_TO = "2026-07-13";
const USE_REAL_API = process.env.E2E_BB_LIVE === "true";

test.describe("Finance Transactions tool", () => {
	test.beforeEach(async ({ page }) => {
		await loginWithSeedEmail(page, SEED_LEGAL_FINANCE_MEMBER_EMAIL);
		await page.goto(FINANCE_TRANSACTIONS_ROUTE);
		await expect(
			page.getByRole("heading", { name: "Finance Transactions" }),
		).toBeVisible();
	});

	test("loads BuchhaltungsButler postings and filters the table", async ({
		page,
	}) => {
		await page.locator("#finance-date-from").fill(FINANCE_2026_FROM);
		await page.locator("#finance-date-to").fill(FINANCE_2026_TO);

		if (USE_REAL_API) {
			await expect
				.poll(() => page.getByRole("table").locator("tbody tr").count())
				.toBeGreaterThan(0);
			return;
		}

		await expect(page.getByText("Sponsoring JetBrains").first()).toBeVisible();
		await expect(page.getByText("Slack subscription").first()).toBeVisible();

		const transactionsTable = page.getByRole("table");
		await expect(
			transactionsTable.locator("tbody tr").first().locator("td").first(),
		).toHaveText("01 Jul 2026");

		await page.getByLabel("Sort order").click();
		await page.getByRole("option", { name: "Oldest first" }).click();
		await expect(
			transactionsTable.locator("tbody tr").first().locator("td").first(),
		).toHaveText("01 Jan 2026");

		await page.getByLabel("Search").fill("slack");

		await expect(
			transactionsTable.getByText("Slack subscription").first(),
		).toBeVisible();
		await expect(
			transactionsTable.getByText("Sponsoring JetBrains"),
		).toHaveCount(0);
	});
});
