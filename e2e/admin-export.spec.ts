import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin, SEED_ADMIN_EMAIL } from "./helpers";

// The admin database view (route "/admin", AdminDatabaseView) exposes three
// client-side exports built from the loaded member list (useAdminDatabase):
//   - "Export as CSV"  -> members_export.csv
//   - "Export as Excel" -> members_export.xlsx
//   - "Download emails" -> filtered_emails.txt
// All three live behind the filter bar; CSV/Excel are inside an "Export"
// dropdown, the emails button is standalone.
//
// Infinite-scroll pagination is intentionally OUT OF SCOPE here: the seed holds
// ~22 members, well under ADMIN_PAGE_SIZE (200), so there is no second page to
// exercise. Seeding 200+ members to force a second page would break the exact
// member-count assertions in members.spec.ts. Instead we assert that the single
// loaded page already contains a known seeded member, then export it.

test.describe("admin database exports", () => {
	test("exports CSV, Excel, and the email list from one loaded page", async ({
		page,
	}) => {
		await loginAsLocalAdmin(page);
		await page.goto("/admin");

		await expect(
			page.getByRole("heading", { name: "Admin Workspace" }),
		).toBeVisible();

		// The whole seeded member set fits on the first page; the seeded admin
		// account is present in the loaded rows that feed the exports.
		await expect(page.getByText(SEED_ADMIN_EMAIL).first()).toBeVisible();

		// --- CSV (inside the Export dropdown) ---------------------------------
		await page.getByRole("button", { name: "Export" }).click();
		const [csvDownload] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("menuitem", { name: "Export as CSV" }).click(),
		]);
		expect(csvDownload.suggestedFilename()).toBe("members_export.csv");
		const csvPath = await csvDownload.path();
		const csvContents = await readFile(csvPath, "utf8");
		expect(csvContents).toContain(SEED_ADMIN_EMAIL);

		// --- Excel (inside the Export dropdown) -------------------------------
		await page.getByRole("button", { name: "Export" }).click();
		const [xlsxDownload] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("menuitem", { name: "Export as Excel" }).click(),
		]);
		expect(xlsxDownload.suggestedFilename()).toBe("members_export.xlsx");

		// --- Emails (standalone button) ---------------------------------------
		const [emailsDownload] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("button", { name: "Download emails" }).click(),
		]);
		expect(emailsDownload.suggestedFilename()).toBe("filtered_emails.txt");
		const emailsPath = await emailsDownload.path();
		const emailsContents = await readFile(emailsPath, "utf8");
		expect(emailsContents).toContain(SEED_ADMIN_EMAIL);
	});
});
