import { expect, type Page, test } from "@playwright/test";
import {
	loginAsLocalAdmin,
	loginWithSeedEmail,
	SEED_LEGAL_FINANCE_MEMBER_EMAIL,
	SEED_MAKEATHON_LEAD_EMAIL,
} from "./helpers";

const FINANCE_ANALYTICS_ROUTE = "/tools/finance/analytics";

// Expand every T-account folder. A folder header is the only disclosure that
// carries a Zielsaldo or a Profit, which keeps line-row disclosures out of it.
// Repeated because expanding a folder can reveal nested ones.
async function expandAllFolders(page: Page): Promise<void> {
	for (let pass = 0; pass < 4; pass += 1) {
		const collapsed = page
			.getByRole("button", { expanded: false })
			.filter({ hasText: /Profit|Zielsaldo/ });
		const count = await collapsed.count();
		if (count === 0) return;
		for (let index = count - 1; index >= 0; index -= 1) {
			await collapsed.nth(index).click();
		}
	}
}

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
		await expect(page.getByText("Einnahmen").first()).toBeVisible();
		await expect(page.getByText("Ausgaben").first()).toBeVisible();
		await expect(page.getByText("Umsatzsteuer")).toBeVisible();

		// Switch to the mapping editor.
		await page.getByRole("tab", { name: "Zuordnung" }).click();
		await expect(
			page.getByRole("columnheader", {
				name: "Kostenstelle",
				exact: true,
			}),
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
		const categoryRow = unlabelledInput.locator("xpath=ancestor::tr");
		await categoryRow
			.getByRole("button", {
				name: /Kategorie für Kostenstelle 2 .* speichern/,
			})
			.click();

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
		const accountRow = unlabelledInput.locator("xpath=ancestor::tr");
		await accountRow
			.getByRole("button", { name: /Bezeichnung für Konto .* speichern/ })
			.click();

		await expect(page.getByText("Konto gespeichert.")).toBeVisible();
	});

	test("sets a department budget and shows budget vs. actual", async ({
		page,
	}) => {
		await page.getByRole("tab", { name: "Budget" }).click();
		await expect(page.getByText("Budget gesamt")).toBeVisible();

		// Enter a budget for the first department row and save on blur.
		const budgetInput = page
			.getByRole("spinbutton", { name: /Budget für/ })
			.first();
		await expect(budgetInput).toBeVisible({ timeout: 20000 });
		await budgetInput.fill("5000");
		await budgetInput.blur();

		await expect(page.getByText("Budget gespeichert.")).toBeVisible();
	});

	test("shows a department T-account with Ist- and Plan-Saldo", async ({
		page,
	}) => {
		await page.getByRole("tab", { name: "T-Konto" }).click();

		// Reviewers first see a prompt to pick a department.
		await expect(page.getByText(/Bitte ein Department wählen/)).toBeVisible();

		await page.getByLabel("Department").click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();

		// The T-account renders both salden and the Ausgaben/Einnahmen columns.
		await expect(page.getByText("Ist-Saldo").first()).toBeVisible({
			timeout: 20000,
		});
		await expect(page.getByText("Plan-Saldo").first()).toBeVisible();
		await expect(page.getByText("Ausgaben").first()).toBeVisible();
		await expect(page.getByText("Einnahmen").first()).toBeVisible();
	});

	test("builds a project from selected invoices and refuses the one that is matched elsewhere", async ({
		page,
	}) => {
		await page.getByRole("tab", { name: "T-Konto" }).click();
		// Community is the department the T-Konto fixtures are seeded for: cost
		// location 111 → Community / Onboarding, with "Onboarding SS Catering"
		// already allocated to the seeded "Onboarding SS26" project and matched to
		// one of its Planposten.
		await page.getByLabel("Department").click();
		await page.getByRole("option", { name: "Community", exact: true }).click();
		await expect(page.getByText("Ist-Saldo").first()).toBeVisible({
			timeout: 20000,
		});

		// Open every folder, so the two invoices are found wherever they currently
		// live. The suite does not reset the database between runs, so the free
		// invoice sits in the sub-team folder on a fresh seed and inside the project
		// a previous run created on any later one — the flow must work from both.
		await expandAllFolders(page);

		const freeInvoice = page.getByRole("checkbox", {
			name: "Onboarding SS Location auswählen",
		});
		await expect(freeInvoice).toBeVisible({ timeout: 20000 });
		await freeInvoice.check();

		// "Onboarding SS Catering" funds a Planposten of the seeded "Onboarding
		// SS26" project, so it can never be moved — it stays put on every run.
		const matchedInvoice = page.getByRole("checkbox", {
			name: "Onboarding SS Catering auswählen",
		});
		await expect(matchedInvoice).toBeVisible();
		await matchedInvoice.check();

		// Selection spans folders and states its size (FR-K1/FR-K5).
		const selectionBar = page.getByRole("region", { name: "Auswahl" });
		await expect(selectionBar.getByText("2 Buchungen")).toBeVisible();

		// One call creates the project and files what may legally be filed (FR-L1).
		const projectName = `E2E Sammelprojekt ${Date.now()}`;
		await selectionBar
			.getByRole("button", { name: /Neues Projekt aus Auswahl/ })
			.click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByText(/2 Buchungen über .* werden dem neuen Projekt/),
		).toBeVisible();
		await dialog.getByLabel("Name").fill(projectName);
		await dialog.getByRole("button", { name: "Anlegen" }).click();

		// The invoice funding another project's Planposten is refused by name
		// rather than silently moved (FR-L6/FR-L7).
		await expect(page.getByText(/1 von 2 Buchungen zugeordnet/)).toBeVisible({
			timeout: 20000,
		});
		await expect(
			page.getByText(/Planposten eines anderen Projekts verknüpft/),
		).toBeVisible();

		// The selection is consumed (FR-K7) and the free invoice now sits in the
		// new project folder.
		await expect(selectionBar).toBeHidden();
		const projectFolder = page.getByRole("button", { name: projectName });
		await expect(projectFolder).toBeVisible({ timeout: 20000 });
		await expect(freeInvoice).toBeHidden();
		await projectFolder.click();
		await expect(freeInvoice).toBeVisible();
	});

	test("drills from the budget overview into a department T-account", async ({
		page,
	}) => {
		await page.getByRole("tab", { name: "Budget" }).click();
		await expect(page.getByText("Budget gesamt")).toBeVisible();

		const drilldown = page
			.getByRole("button", { name: /T-Konto für .* öffnen/ })
			.first();
		await expect(drilldown).toBeVisible({ timeout: 20000 });
		await drilldown.click();

		// The T-Konto tab is now active with a department preselected, so the
		// "pick a department" prompt is gone and the salden are shown.
		await expect(page.getByText("Ist-Saldo").first()).toBeVisible({
			timeout: 20000,
		});
	});

	test("adds a plan line item", async ({ page }) => {
		await page.getByRole("tab", { name: "Planung" }).click();
		await expect(page.getByText("Planposten hinzufügen")).toBeVisible();

		// Reviewer must choose a department, then fill the line item.
		await page.getByLabel("Department").click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();
		await page.getByLabel("Bezeichnung").fill("Venue deposit");
		await page.getByLabel("Betrag (€)").fill("3000");
		await page.getByRole("button", { name: /Hinzufügen/ }).click();

		await expect(page.getByText("Planposten hinzugefügt.")).toBeVisible();
	});

	test("runs planning, allocation, reallocation, matching, reporting, and reimbursement linkage", async ({
		page,
		browser,
	}) => {
		await page.getByRole("tab", { name: "Projekte" }).click();
		await expect(
			page.getByRole("heading", { name: "Projekt anlegen" }),
		).toBeVisible();

		const unique = Date.now();
		const projectName = `E2E Finance Project ${unique}`;
		const templateName = `E2E Event Template ${unique}`;
		const planItemName = `E2E Venue Plan ${unique}`;

		await page.getByLabel("Neue Vorlage").fill(templateName);
		await page.getByRole("button", { name: "Anlegen", exact: true }).click();
		await expect(page.getByText("Plan template created.")).toBeVisible();
		await page.getByRole("button", { name: new RegExp(templateName) }).click();
		const templateRegion = page.getByRole("region", { name: templateName });
		await templateRegion
			.getByRole("textbox", { name: "Position" })
			.fill(planItemName);
		await templateRegion
			.getByRole("spinbutton", { name: "Betrag (€)" })
			.fill("5000");
		await templateRegion
			.getByRole("textbox", { name: "Position" })
			.locator("xpath=ancestor::form")
			.getByRole("button", { name: "Position", exact: true })
			.click();
		await expect(page.getByText("Template item added.")).toBeVisible();

		await page.getByLabel("Name *").fill(projectName);
		await page.getByLabel("Projekt-Department").click();
		await page.getByRole("option", { name: "Makeathon", exact: true }).click();
		await page.getByLabel("Zielbetrag (€) *").fill("-5000");
		await page.getByRole("button", { name: "Projekt anlegen" }).click();
		await expect(page.getByText("Finance project created.")).toBeVisible();
		const projectRow = page.getByRole("row").filter({ hasText: projectName });
		await expect(projectRow).toBeVisible();
		await projectRow.getByRole("combobox", { name: /Vorlage für/ }).click();
		await page.getByRole("option", { name: templateName }).click();
		await projectRow
			.getByRole("button", { name: new RegExp(`Vorlage auf ${projectName}`) })
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
		await departmentPage.getByRole("tab", { name: "Abgleich" }).click();
		const budgetTransferSection = departmentPage.getByRole("region", {
			name: "Budgetübertragungen",
		});
		await budgetTransferSection.getByLabel("Budgetziel").click();
		await departmentPage
			.getByRole("option", { name: "Community", exact: true })
			.click();
		await budgetTransferSection.getByLabel("Betrag (€)").fill("250");
		await budgetTransferSection
			.getByLabel("Begründung")
			.fill("Share unused Makeathon venue budget");
		await budgetTransferSection
			.getByRole("button", { name: "Anfragen" })
			.click();
		await expect(
			departmentPage.getByText("Budget transfer request submitted."),
		).toBeVisible();

		const departmentVenue = departmentPage
			.getByRole("button", { name: /Makeathon venue/ })
			.first();
		await expect(departmentVenue).toBeVisible();
		await departmentVenue.click();
		await departmentPage.getByLabel("Projekt für Aufteilung 1").click();
		await departmentPage.getByRole("option", { name: projectName }).click();
		await departmentPage
			.getByLabel("Begründung *")
			.fill("Assign the venue to the approved Makeathon project");
		await departmentPage
			.getByRole("button", { name: "Anfrage senden" })
			.click();
		await expect(
			departmentPage.getByText("Reallocation request submitted."),
		).toBeVisible();
		await departmentContext.close();

		await page.getByRole("tab", { name: "Abgleich" }).click();
		await expect(page.getByText("Nicht abgeglichen").first()).toBeVisible();
		await expect(page.getByText("Nicht geplant").first()).toBeVisible();
		await page.reload();
		await page.getByRole("tab", { name: "Abgleich" }).click();

		const budgetTransferReview = page
			.locator("div.grid")
			.filter({ hasText: "Share unused Makeathon venue budget" })
			.first();
		await expect(budgetTransferReview).toBeVisible();
		await budgetTransferReview
			.getByRole("button", { name: "Genehmigen" })
			.click();
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

		const reallocationReview = page.getByLabel("Review-Notiz für Makeathon");
		await expect(reallocationReview).toBeVisible();
		await reallocationReview.fill("Project assignment confirmed");
		await reallocationReview
			.locator("xpath=ancestor::div[contains(@class,'lg:grid-cols')][1]")
			.getByRole("button", { name: "Genehmigen" })
			.click();
		await expect(page.getByText("Reallocation approved.")).toBeVisible();

		const venueRow = page
			.getByRole("button", { name: /Makeathon venue/ })
			.first();
		await expect(venueRow).toBeVisible();
		await venueRow.click();
		await page.getByLabel("Planposten zuordnen").click();
		await page.getByRole("option", { name: new RegExp(planItemName) }).click();
		await page.getByRole("button", { name: "Abgleichen" }).click();
		await expect(page.getByText("Posting matched to plan item.")).toBeVisible();

		const cateringRow = page
			.getByRole("button", { name: /Makeathon catering/ })
			.first();
		await expect(cateringRow).toBeVisible();
		await cateringRow.click();
		await page.getByLabel("Projekt für vollständige Zuordnung").click();
		await page.getByRole("option", { name: new RegExp(projectName) }).click();
		await page.getByRole("button", { name: "Vollständig zuordnen" }).click();
		await expect(page.getByText("Posting allocation saved.")).toBeVisible();

		await page.getByRole("tab", { name: "Berichte" }).click();
		await expect(page.getByText("Budget").first()).toBeVisible();
		await expect(page.getByText("Forecast").first()).toBeVisible();
		await expect(
			page.getByRole("button", { name: "XLSX exportieren" }),
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
