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
	// Wait for the tree itself first. Called too early, the loop below would find
	// nothing to expand and return as if the work were done.
	await expect(page.getByText(/Grau = geplant/)).toBeVisible({
		timeout: 20000,
	});
	// One folder per iteration, re-querying every time: expanding a folder both
	// reveals nested folders and renumbers the list, so indexing into a live
	// locator silently skips some of them.
	for (let opened = 0; opened < 25; opened += 1) {
		const collapsed = page
			.getByRole("button", { expanded: false })
			.filter({ hasText: /Profit|Zielsaldo/ });
		if ((await collapsed.count()) === 0) return;
		await collapsed.first().click();
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
		await page.getByRole("tab", { name: "Einstellungen" }).click();
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
		// The category breakdown is a panel of Übersicht now (FR-O), not a tab.
		await expect(page.getByText("Ausgaben pro Kategorie")).toBeVisible();

		// The category editor lives under Einstellungen, below the department one.
		await page.getByRole("tab", { name: "Einstellungen" }).click();
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
		// The account breakdown is a panel of Übersicht now (FR-O), not a tab.
		await expect(page.getByText("Ausgaben pro Konto")).toBeVisible();

		// The account editor lives under Einstellungen, below the others.
		await page.getByRole("tab", { name: "Einstellungen" }).click();
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

		// The amount mode is stated, not implied, and the toggle switches it
		// (FR-N4).
		await expect(page.getByText(/Beträge brutto/)).toBeVisible();
		await page.getByRole("radio", { name: "Nettobeträge" }).click();
		await expect(page.getByText(/Beträge netto/)).toBeVisible();
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

	test("plans, matches an invoice, and corrects the plan to the actual", async ({
		page,
	}) => {
		await page.getByRole("tab", { name: "T-Konto" }).click();
		await page.getByLabel("Department").click();
		await page.getByRole("option", { name: "Community", exact: true }).click();
		await expect(page.getByText("Ist-Saldo").first()).toBeVisible({
			timeout: 20000,
		});
		await expandAllFolders(page);

		// Plan in the folder the invoice actually sits in (FR-M1). It has to be that
		// folder: a Planposten can only absorb the part of a posting allocated to
		// its own department *and* project, so a department-level Planposten cannot
		// take an invoice that belongs to a project. Which folder that is depends on
		// what earlier specs did with the invoice, so it is looked up rather than
		// assumed. The amount is deliberately larger than the invoice, so the
		// correction has something to correct.
		const planLabel = `E2E Planposten ${Date.now()}`;
		const invoice = page.getByRole("checkbox", {
			name: "Onboarding SS Location auswählen",
		});
		await expect(invoice).toBeVisible({ timeout: 20000 });
		const invoiceFolder = page
			.getByRole("group")
			.filter({ has: invoice })
			.last();
		await invoiceFolder
			.getByRole("button", { name: "Neuer Planposten" })
			.first()
			.click();
		const planDialog = page.getByRole("dialog");
		await planDialog.getByLabel("Bezeichnung").fill(planLabel);
		await planDialog.getByLabel("Betrag (€)").fill("5000");
		await planDialog.getByRole("button", { name: "Anlegen" }).click();
		await expect(page.getByText("Planposten angelegt.")).toBeVisible({
			timeout: 20000,
		});

		// It shows up as a planned line and expands to its own detail (FR-K4).
		await expandAllFolders(page);
		const planRow = page.getByRole("button", { name: new RegExp(planLabel) });
		await expect(planRow).toBeVisible({ timeout: 20000 });
		await planRow.click();

		// Match an invoice to it from the Planposten side (FR-M5).
		await page.getByRole("button", { name: "Buchung zuordnen" }).click();
		const matchDialog = page.getByRole("dialog");
		await matchDialog.getByLabel("Buchung").click();
		await page.getByRole("option", { name: /Onboarding SS Location/ }).click();
		await matchDialog.getByRole("button", { name: "Zuordnen" }).click();
		await expect(
			page.getByText("Buchung dem Planposten zugeordnet."),
		).toBeVisible({ timeout: 20000 });

		// The match moved the status on its own: planned → committed (FR-M4).
		await expandAllFolders(page);
		await page.getByRole("button", { name: new RegExp(planLabel) }).click();
		await expect(page.getByText("Zugesagt").first()).toBeVisible();

		// Plan 5.000 vs Ist 600 — correcting sets the plan to what arrived (FR-M6).
		await page
			.getByRole("button", { name: /Plan auf Ist korrigieren/ })
			.click();
		await expect(page.getByText("Plan auf Ist korrigiert.")).toBeVisible({
			timeout: 20000,
		});

		// Fully matched now, so the Planposten no longer carries an open remainder
		// and drops out of the plan column entirely.
		await expandAllFolders(page);
		await expect(
			page.getByRole("button", { name: new RegExp(planLabel) }),
		).toBeHidden();

		// Detaching from the invoice side restores the open remainder and walks the
		// status back (FR-M7) — which also returns the seeded invoice to the state
		// the other specs expect, so this one can run again without a reset.
		await page
			.getByRole("button", { name: /Onboarding SS Location/ })
			.first()
			.click();
		await page
			.getByRole("button", { name: new RegExp(`Zuordnung ${planLabel}`) })
			.click();
		await expect(page.getByText("Zuordnung entfernt.")).toBeVisible({
			timeout: 20000,
		});

		await expandAllFolders(page);
		const revived = page.getByRole("button", { name: new RegExp(planLabel) });
		await expect(revived).toBeVisible({ timeout: 20000 });
		await revived.click();
		await expect(page.getByText("Geplant").first()).toBeVisible();
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

	test("runs template setup, both approval flows, reporting, and reimbursement linkage", async ({
		page,
		browser,
	}) => {
		const unique = Date.now();
		const projectName = `E2E Finance Project ${unique}`;
		const templateName = `E2E Event Template ${unique}`;
		const planItemName = `E2E Venue Plan ${unique}`;

		// Plan templates moved to Einstellungen (FR-O); project creation moved to
		// the T-view and is covered by its own spec, so this one creates the
		// project through the API and stays focused on approvals and reporting.
		await page.getByRole("tab", { name: "Einstellungen" }).click();
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

		await page.evaluate(async (name) => {
			const { apiClient } = await import("/src/lib/apiClient.ts");
			await apiClient("/api/finance/projects", {
				method: "POST",
				body: JSON.stringify({
					name,
					department: "Makeathon",
					period_type: "year",
					period_key: "2026",
					target_amount: -5000,
					status: "draft",
				}),
			});
		}, projectName);

		// The template is applied from Einstellungen now that project rows are
		// gone (FR-O).
		await page.reload();
		await page.getByRole("tab", { name: "Einstellungen" }).click();
		const assignRegion = page.getByRole("region", {
			name: "Vorlage auf Projekt anwenden",
		});
		await assignRegion.getByLabel("Projekt").click();
		await page.getByRole("option", { name: new RegExp(projectName) }).click();
		await assignRegion.getByLabel("Vorlage").click();
		await page.getByRole("option", { name: templateName }).click();
		await assignRegion.getByRole("button", { name: "Anwenden" }).click();
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
		await departmentPage.getByRole("tab", { name: "Anträge" }).click();
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

		// Asking another department to take a posting now starts at the invoice
		// itself, in the T-view (FR-O).
		await departmentPage.getByRole("tab", { name: "T-Konto" }).click();
		await expandAllFolders(departmentPage);
		await departmentPage
			.getByRole("button", { name: /Makeathon venue/ })
			.first()
			.click();
		await departmentPage
			.getByRole("button", { name: "Umverteilung beantragen" })
			.first()
			.click();
		const requestDialog = departmentPage.getByRole("dialog");
		await requestDialog.getByLabel("Projekt für Aufteilung 1").click();
		await departmentPage.getByRole("option", { name: projectName }).click();
		await requestDialog
			.getByLabel("Begründung *")
			.fill("Assign the venue to the approved Makeathon project");
		await requestDialog.getByRole("button", { name: "Anfrage senden" }).click();
		await expect(
			departmentPage.getByText("Reallocation request submitted."),
		).toBeVisible();
		await departmentContext.close();

		await page.reload();
		await page.getByRole("tab", { name: "Anträge" }).click();

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
