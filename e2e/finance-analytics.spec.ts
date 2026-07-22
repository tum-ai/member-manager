import { expect, test } from "@playwright/test";
import {
	loginAsLocalAdmin,
	loginWithSeedEmail,
	SEED_LEGAL_FINANCE_MEMBER_EMAIL,
	SEED_MAKEATHON_LEAD_EMAIL,
} from "./helpers";

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
		// Overview renders the aggregated totals and the VAT summary.
		await expect(page.getByText("Income").first()).toBeVisible();
		await expect(page.getByText("Expenses").first()).toBeVisible();
		await expect(page.getByText("VAT", { exact: true }).first()).toBeVisible();

		// Switch to the mapping editor.
		await page.getByRole("tab", { name: "Mapping" }).click();
		await expect(
			page.getByRole("columnheader", {
				name: "Cost location",
				exact: true,
			}),
		).toBeVisible();

		// Pick the first still-unassigned cost location and assign a department.
		// Loading the postings can take a moment against the live API.
		const unassignedRow = page
			.getByRole("row")
			.filter({ hasText: "Unassigned" })
			.first();
		await expect(unassignedRow).toBeVisible({ timeout: 20000 });

		// Department is picked from a dropdown, then saved explicitly.
		await unassignedRow
			.getByRole("combobox", { name: /Department for cost location/ })
			.click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();
		await unassignedRow
			.getByRole("button", { name: /Save mapping for cost location .*/ })
			.click();

		await expect(page.getByText("Mapping saved.")).toBeVisible();
	});

	test("shows the category breakdown and labels a second cost location", async ({
		page,
	}) => {
		// Category breakdown tab renders the by-category table.
		await page.getByRole("tab", { name: "Categories" }).click();
		await expect(page.getByText("Expenses by category")).toBeVisible();

		// The category editor lives under the mapping tab, below the department one.
		await page.getByRole("tab", { name: "Mapping" }).click();
		await expect(
			page.getByRole("columnheader", { name: "Cost location 2" }),
		).toBeVisible();

		const unlabelledInput = page
			.getByRole("textbox", { name: /Category for cost location 2/ })
			.first();
		await expect(unlabelledInput).toBeVisible({ timeout: 20000 });
		await unlabelledInput.fill("Catering");
		const categoryRow = unlabelledInput.locator("xpath=ancestor::tr");
		await categoryRow
			.getByRole("button", {
				name: /Save category for cost location 2 .*/,
			})
			.click();

		await expect(page.getByText("Category saved.")).toBeVisible();
	});

	test("shows the account breakdown and labels a ledger account", async ({
		page,
	}) => {
		// Accounts breakdown tab renders the by-account table.
		await page.getByRole("tab", { name: "Accounts" }).click();
		await expect(page.getByText("Expenses by account")).toBeVisible();

		// The account editor lives under the mapping tab, below the others.
		await page.getByRole("tab", { name: "Mapping" }).click();
		await expect(
			page.getByRole("columnheader", { name: "Account", exact: true }),
		).toBeVisible();

		const unlabelledInput = page
			.getByRole("textbox", { name: /Label for account/ })
			.first();
		await expect(unlabelledInput).toBeVisible({ timeout: 20000 });
		await unlabelledInput.fill("Software & Tools");
		const accountRow = unlabelledInput.locator("xpath=ancestor::tr");
		await accountRow
			.getByRole("button", { name: /Save label for account .*/ })
			.click();

		await expect(page.getByText("Account label saved.")).toBeVisible();
	});

	test("sets a department budget and shows budget vs. actual", async ({
		page,
	}) => {
		await page.getByRole("tab", { name: "Budget" }).click();
		await expect(page.getByText("Total budget")).toBeVisible();

		// Enter a budget for the first department row and save on blur.
		const budgetInput = page
			.getByRole("spinbutton", { name: /Budget for/ })
			.first();
		await expect(budgetInput).toBeVisible({ timeout: 20000 });
		await budgetInput.fill("5000");
		await budgetInput.blur();

		await expect(page.getByText("Budget saved.")).toBeVisible();
	});

	test("adds a plan line item", async ({ page }) => {
		await page.getByRole("tab", { name: "Planning" }).click();
		await expect(page.getByText("Add plan item")).toBeVisible();

		// Reviewer must choose a department, then fill the line item.
		await page.getByLabel("Department").click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();
		await page.getByLabel("Label").fill("Venue deposit");
		await page.getByLabel("Amount (€)").fill("3000");
		await page.getByRole("button", { name: /Add/ }).click();

		await expect(page.getByText("Plan item added.")).toBeVisible();
	});

	test("runs planning, allocation, reallocation, matching, reporting, and reimbursement linkage", async ({
		page,
		browser,
	}) => {
		await page.getByRole("tab", { name: "Projects" }).click();
		await expect(
			page.getByRole("heading", { name: "Create project" }),
		).toBeVisible();

		const unique = Date.now();
		const projectName = `E2E Finance Project ${unique}`;
		const templateName = `E2E Event Template ${unique}`;
		const planItemName = `E2E Venue Plan ${unique}`;

		await page.getByLabel("New template").fill(templateName);
		await page.getByRole("button", { name: "Create", exact: true }).click();
		await expect(page.getByText("Plan template created.")).toBeVisible();
		await page.getByRole("button", { name: new RegExp(templateName) }).click();
		const templateRegion = page.getByRole("region", { name: templateName });
		await templateRegion
			.getByRole("textbox", { name: "Item" })
			.fill(planItemName);
		await templateRegion
			.getByRole("spinbutton", { name: "Amount (€)" })
			.fill("5000");
		await templateRegion
			.getByRole("textbox", { name: "Item" })
			.locator("xpath=ancestor::form")
			.getByRole("button", { name: "Add item", exact: true })
			.click();
		await expect(page.getByText("Template item added.")).toBeVisible();

		await page.getByLabel("Name *").fill(projectName);
		await page.getByLabel("Project department").click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();
		await page.getByLabel("Target amount (€) *").fill("-5000");
		await page.getByRole("button", { name: "Create project" }).click();
		await expect(page.getByText("Finance project created.")).toBeVisible();
		const projectRow = page.getByRole("row").filter({ hasText: projectName });
		await expect(projectRow).toBeVisible();
		await projectRow.getByRole("combobox", { name: /Template for/ }).click();
		await page.getByRole("option", { name: templateName }).click();
		await projectRow
			.getByRole("button", {
				name: new RegExp(`Apply template to ${projectName}`),
			})
			.click();
		await expect(page.getByText("1 plan item(s) created.")).toBeVisible();

		const postingIds = await page.evaluate(async () => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			const response = await apiClient<{
				transactions: Array<{ external_id: string; postingtext: string }>;
			}>(
				"/api/finance/buchhaltungsbutler/transactions?date_from=2026-05-04&date_to=2026-05-04",
			);
			return {
				venue: response.transactions.find(
					(row) => row.postingtext === "Makeathon venue",
				)?.external_id,
				catering: response.transactions.find(
					(row) => row.postingtext === "Makeathon catering",
				)?.external_id,
			};
		});
		expect(postingIds.venue).toBeTruthy();
		expect(postingIds.catering).toBeTruthy();
		await page.evaluate(async () => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			// Assign the Makeathon cost location (161 — venue & catering) to the
			// Makeathon department. There is no automatic department fallback, so a
			// department member only sees postings mapped to them via the Zuordnung.
			await apiClient("/api/finance/department-mappings/161", {
				method: "PUT",
				body: JSON.stringify({ department: "Makeathon", bereich: null }),
			});
			for (const budget of [
				{ department: "Makeathon", amount_planned: 10000 },
				{ department: "Community", amount_planned: 1000 },
			]) {
				await apiClient("/api/finance/budgets", {
					method: "PUT",
					body: JSON.stringify({
						...budget,
						period_type: "year",
						period_key: "2026",
						note: "E2E budget transfer baseline",
					}),
				});
			}
		});

		const adminSetupContext = await browser.newContext();
		const adminSetupPage = await adminSetupContext.newPage();
		await loginAsLocalAdmin(adminSetupPage);
		await adminSetupPage.evaluate(async () => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			const current = await apiClient<{
				assignments: Record<string, string[]>;
			}>("/api/admin/department-permissions");
			await apiClient("/api/admin/department-permissions", {
				method: "PUT",
				body: JSON.stringify({
					assignments: {
						...current.assignments,
						Makeathon: [
							...new Set([
								...(current.assignments.Makeathon ?? []),
								"finance.department",
							]),
						],
					},
				}),
			});
		});
		await adminSetupContext.close();

		const departmentContext = await browser.newContext();
		const departmentPage = await departmentContext.newPage();
		await loginWithSeedEmail(departmentPage, SEED_MAKEATHON_LEAD_EMAIL);
		await departmentPage.goto(FINANCE_ANALYTICS_ROUTE);
		await departmentPage.getByRole("tab", { name: "Reconciliation" }).click();
		const budgetTransferSection = departmentPage.getByRole("region", {
			name: "Budget transfers",
		});
		await budgetTransferSection.getByLabel("Budget destination").click();
		await departmentPage
			.getByRole("option", { name: "Community", exact: true })
			.click();
		await budgetTransferSection.getByLabel("Amount (€)").fill("250");
		await budgetTransferSection
			.getByLabel("Reason")
			.fill("Share unused Makeathon venue budget");
		await budgetTransferSection
			.getByRole("button", { name: "Request" })
			.click();
		await expect(
			departmentPage.getByText("Budget transfer request submitted."),
		).toBeVisible();

		const departmentVenue = departmentPage
			.getByRole("button", { name: /Makeathon venue/ })
			.first();
		await expect(departmentVenue).toBeVisible();
		await departmentVenue.click();
		await departmentPage.getByLabel("Project for allocation 1").click();
		await departmentPage.getByRole("option", { name: projectName }).click();
		await departmentPage
			.getByLabel("Reason *")
			.fill("Assign the venue to the approved Makeathon project");
		await departmentPage
			.getByRole("button", { name: "Submit request" })
			.click();
		await expect(
			departmentPage.getByText("Reallocation request submitted."),
		).toBeVisible();
		await departmentContext.close();

		await page.getByRole("tab", { name: "Reconciliation" }).click();
		await expect(page.getByText("Unmatched").first()).toBeVisible();
		await expect(page.getByText("Unplanned").first()).toBeVisible();
		await page.reload();
		await page.getByRole("tab", { name: "Reconciliation" }).click();

		const budgetTransferReview = page
			.locator("div.grid")
			.filter({ hasText: "Share unused Makeathon venue budget" })
			.first();
		await expect(budgetTransferReview).toBeVisible();
		await budgetTransferReview.getByRole("button", { name: "Approve" }).click();
		await expect(page.getByText("Budget transfer approved.")).toBeVisible();
		const transferredBudgets = await page.evaluate(async () => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			return await apiClient<{
				rows: Array<{
					department: string;
					amount_planned: number | null;
				}>;
			}>("/api/finance/budgets?period_type=year&period_key=2026");
		});
		expect(
			transferredBudgets.rows.find((row) => row.department === "Makeathon")
				?.amount_planned,
		).toBe(9750);
		expect(
			transferredBudgets.rows.find((row) => row.department === "Community")
				?.amount_planned,
		).toBe(1250);

		const reallocationReview = page.getByLabel("Review note for Makeathon");
		await expect(reallocationReview).toBeVisible();
		await reallocationReview.fill("Project assignment confirmed");
		await reallocationReview
			.locator("xpath=ancestor::div[contains(@class,'lg:grid-cols')][1]")
			.getByRole("button", { name: "Approve" })
			.click();
		await expect(page.getByText("Reallocation approved.")).toBeVisible();

		const venueRow = page
			.getByRole("button", { name: /Makeathon venue/ })
			.first();
		await expect(venueRow).toBeVisible();
		await venueRow.click();
		await page.getByLabel("Match plan item").click();
		await page.getByRole("option", { name: new RegExp(planItemName) }).click();
		await page.getByRole("button", { name: "Match" }).click();
		await expect(page.getByText("Posting matched to plan item.")).toBeVisible();

		const cateringRow = page
			.getByRole("button", { name: /Makeathon catering/ })
			.first();
		await expect(cateringRow).toBeVisible();
		await cateringRow.click();
		await page.getByLabel("Project for full allocation").click();
		await page.getByRole("option", { name: new RegExp(projectName) }).click();
		await page.getByRole("button", { name: "Allocate fully" }).click();
		await expect(page.getByText("Posting allocation saved.")).toBeVisible();

		await page.getByRole("tab", { name: "Reports" }).click();
		await expect(page.getByText("Budget").first()).toBeVisible();
		await expect(page.getByText("Forecast").first()).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Export XLSX" }),
		).toBeEnabled();

		const report = await page.evaluate(async () => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			return await apiClient<{
				totals: { plan: number; actual: number };
				tax_area_totals: Array<{ tax_area: string | null }>;
			}>(
				"/api/finance/reports/period-summary?period_type=year&period_key=2026",
			);
		});
		expect(report.totals.plan).toBeGreaterThanOrEqual(5000);
		expect(report.totals.actual).toBeGreaterThan(0);
		expect(
			report.tax_area_totals.every((row) => row.tax_area !== "gemischt"),
		).toBe(true);

		await page.goto("/tools/reimbursement/review");
		await page
			.getByLabel("Search reimbursement queue")
			.fill("Makeathon prototype materials");
		await page
			.getByRole("button", { name: /Makeathon prototype materials/ })
			.click();
		await page.getByLabel("Finance project").click();
		await page.getByRole("option", { name: projectName }).click();
		await page.getByLabel("Finance plan item").click();
		await page.getByRole("option", { name: new RegExp(planItemName) }).click();
		await page.getByLabel("BB posting").click();
		await page
			.getByText(/2026-05-04 · Makeathon venue/)
			.first()
			.click();
		await page.getByRole("button", { name: "Save links" }).click();
		await expect(page.getByText("Finance links updated.")).toBeVisible();

		const linkedRequest = await page.evaluate(async () => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			const response = await apiClient<
				Array<{
					description: string;
					finance_project_id: string | null;
					finance_plan_item_id: string | null;
					bb_posting_external_id: string | null;
				}>
			>("/api/reimbursements/review");
			return response.find(
				(request) => request.description === "Makeathon prototype materials",
			);
		});
		expect(linkedRequest?.finance_project_id).toBeTruthy();
		expect(linkedRequest?.finance_plan_item_id).toBeTruthy();
		expect(linkedRequest?.bb_posting_external_id).toBe(postingIds.venue);
	});
});
