import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalAdmin } from "./helpers";

// Admin-workspace regression harness. Runs against the real seeded stack (no
// mocks): the admin account (admin@example.com, President + admin access role)
// inherits every elevated permission, so it reaches /admin and the review
// queues. Seeded rows assert against come from supabase/seed.sql.
//
// MUTATION NOTE: the review-queue tests (change/certificate/job requests)
// transition seeded PENDING rows to approved/rejected. Like contract-sign.spec,
// that mutates shared DB state and is therefore ONE-SHOT per fresh database. CI
// reseeds Supabase each run, so a clean run passes; for repeated local runs
// reset the DB (`pnpm supabase:reset`) in between. Each mutating test targets a
// SPECIFIC seeded member by name so parallel specs and the other cases in this
// file don't collide on the same row.

test.describe("admin member directory", () => {
	test("edits a member field and persists it across a reload", async ({
		page,
	}) => {
		// The member editor dialog is tall and centered; on the default viewport its
		// footer "Save" button is clipped off-screen and unclickable. Use a taller
		// viewport so the whole dialog (and its save button) is reachable.
		await page.setViewportSize({ width: 1280, height: 1800 });
		await loginAsLocalAdmin(page);
		await page.goto("/admin");

		// Header + metric cards prove the workspace mounted with data.
		await expect(
			page.getByRole("heading", { name: "Admin Workspace" }),
		).toBeVisible();
		await expect(page.getByText("Total members")).toBeVisible();
		await expect(page.getByText("Active members")).toBeVisible();
		await expect(page.getByText("SEPA accepted")).toBeVisible();
		await expect(page.getByText("Privacy accepted")).toBeVisible();

		// Target a stable seeded member by name and open its editor dialog. The
		// pencil button exposes aria-label="Edit member {given} {surname}". Use an
		// executive (Vice-President): executives are not assigned a department, so
		// the editor's "department required for Member/Team Lead" guard never
		// disables the save (non-executives can open with an unresolved department).
		const memberName = "Vera Vice";
		await page
			.getByRole("button", { name: `Edit member ${memberName}` })
			.click();

		await expect(
			page.getByRole("heading", { name: "Edit member" }),
		).toBeVisible();

		// "Public location" is a free-text field (id="edit-location"). Use a unique
		// value so the assertion is independent of any seeded value and re-runs stay
		// deterministic.
		const nextLocation = `Munich Admin Edit ${Date.now()}`;
		const locationInput = page.getByLabel("Public location");
		await locationInput.fill(nextLocation);

		// Save and wait for the underlying PATCH to /api/admin/members/:id to
		// resolve before asserting, so the table refetch has real data.
		const memberSaved = page.waitForResponse(
			(response) =>
				/\/api\/admin\/members\/[^/]+$/.test(response.url()) &&
				response.request().method() === "PATCH" &&
				response.ok(),
		);
		// The editor dialog is tall; its footer save button can sit below the fold,
		// so scroll it into view before clicking.
		const saveButton = page.getByRole("button", {
			name: "Save member changes",
		});
		await saveButton.scrollIntoViewIfNeeded();
		await saveButton.click();
		await memberSaved;

		await expectToast(page, "Member updated successfully");

		// The dialog closes on success; the value lands in the member's table row.
		await expect(
			page.getByRole("heading", { name: "Edit member" }),
		).toBeHidden();
		await expect(page.getByRole("cell", { name: nextLocation })).toBeVisible();

		// Reload to prove the value was written server-side, not just held in
		// client state, then reopen the editor and confirm it round-tripped.
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "Admin Workspace" }),
		).toBeVisible();
		await expect(page.getByRole("cell", { name: nextLocation })).toBeVisible();

		await page
			.getByRole("button", { name: `Edit member ${memberName}` })
			.click();
		await expect(page.getByLabel("Public location")).toHaveValue(nextLocation);
	});

	test("filters the directory by search and shows the empty state", async ({
		page,
	}) => {
		await loginAsLocalAdmin(page);
		await page.goto("/admin");

		await expect(
			page.getByRole("heading", { name: "Admin Workspace" }),
		).toBeVisible();

		const search = page.getByLabel("Search members");

		// A name query narrows the table to the matching member and drops others.
		await search.fill("Maya Makeathon");
		await expect(
			page.getByRole("cell", { name: /Maya Makeathon/ }),
		).toBeVisible();
		await expect(
			page.getByRole("cell", { name: /Clara Community/ }),
		).toBeHidden();

		// A no-match query surfaces the exact empty-state copy.
		await search.fill(`no-such-member-${Date.now()}`);
		await expect(
			page.getByText("No members match the current filters"),
		).toBeVisible();

		// Combining the cleared search with a select filter still renders the table
		// (drives at least one shadcn Select filter end to end).
		await search.fill("");
		await page.getByRole("combobox", { name: "Member state" }).click();
		await page.getByRole("option", { name: "Active", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
	});
});

test.describe("admin change requests queue", () => {
	// ONE-SHOT: approves the seeded pending change request for "Clara Community"
	// (user 0005, member_status -> alumni). After approval it leaves the pending
	// list. Targets Clara specifically so the directory-edit test (Maya) and the
	// other queue tests don't touch the same row.
	test("approves a pending change request", async ({ page }) => {
		await loginAsLocalAdmin(page);
		await page.goto("/admin/change-requests");

		await expect(
			page.getByRole("heading", { name: "Member Change Requests" }),
		).toBeVisible();

		const memberName = "Clara Community";
		await expect(
			page.getByText(`Change request for ${memberName}`),
		).toBeVisible();

		const reviewed = page.waitForResponse(
			(response) =>
				/\/api\/admin\/member-change-requests\/[^/]+$/.test(response.url()) &&
				response.ok(),
		);
		await page
			.getByRole("button", { name: `Approve change request for ${memberName}` })
			.click();
		await reviewed;

		await expectToast(page, "Change request approved");

		// The approved item leaves the pending list.
		await expect(
			page.getByText(`Change request for ${memberName}`),
		).toBeHidden();
	});
});

test.describe("admin certificate requests queue", () => {
	// ONE-SHOT: approves the seeded pending engagement certificate request for
	// "Regular User" (user 0020). Opens the details modal first to assert the
	// engagement fields rendered, then approves.
	test("inspects and approves a certificate request", async ({ page }) => {
		await loginAsLocalAdmin(page);
		await page.goto("/admin/certificate-requests");

		await expect(
			page.getByRole("heading", { name: "Engagement Certificate Requests" }),
		).toBeVisible();

		const memberName = "Regular User";
		await expect(
			page.getByText(`Engagement certificate request for ${memberName}`),
		).toBeVisible();

		// Open the details modal and assert the seeded engagement fields.
		await page
			.getByRole("button", {
				name: `View engagement certificate details for ${memberName}`,
			})
			.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("Engagement 1")).toBeVisible();
		await expect(dialog.getByText("Start Date")).toBeVisible();
		await expect(dialog.getByText("2024-04-01")).toBeVisible();
		// Seed marks this engagement still active, so End Date renders that label.
		await expect(dialog.getByText("Still active")).toBeVisible();
		await expect(dialog.getByText("5 hours")).toBeVisible();
		await expect(dialog.getByText("Software Development")).toBeVisible();

		// Two controls are named "Close" (the footer button + the dialog's "X"
		// icon); the footer button is first.
		await dialog.getByRole("button", { name: "Close" }).first().click();
		await expect(dialog).toBeHidden();

		const reviewed = page.waitForResponse(
			(response) =>
				/\/api\/admin\/engagement-certificate-requests\/[^/]+$/.test(
					response.url(),
				) && response.ok(),
		);
		await page
			.getByRole("button", {
				name: `Approve engagement certificate request for ${memberName}`,
			})
			.click();
		await reviewed;

		await expectToast(page, "Certificate request approved");
		await expect(
			page.getByText(`Engagement certificate request for ${memberName}`),
		).toBeHidden();
	});
});

test.describe("admin job requests queue", () => {
	// ONE-SHOT: rejects the seeded pending job posting "Working Student – Machine
	// Learning" (user 0020). Targets this specific posting by its requester name
	// so it doesn't collide with the other seeded pending posting (Robin
	// Research / "Part-Time Frontend Developer").
	test("rejects a pending job posting request", async ({ page }) => {
		await loginAsLocalAdmin(page);
		await page.goto("/admin/job-requests");

		await expect(
			page.getByRole("heading", { name: "Job Postings" }),
		).toBeVisible();

		// The seeded pending posting renders its title and organization.
		await expect(
			page.getByRole("heading", {
				name: "Working Student – Machine Learning",
			}),
		).toBeVisible();
		await expect(page.getByText("Acme AI GmbH")).toBeVisible();

		const requesterName = "Regular User";
		const reviewed = page.waitForResponse(
			(response) =>
				/\/api\/admin\/job-requests\/[^/]+$/.test(response.url()) &&
				response.request().method() === "PATCH" &&
				response.ok(),
		);
		await page
			.getByRole("button", {
				name: `Reject job posting request for ${requesterName}`,
			})
			.click();
		await reviewed;

		await expectToast(page, "Job request rejected");

		// The rejected posting leaves the pending list; the other seeded pending
		// posting remains.
		await expect(
			page.getByRole("heading", {
				name: "Working Student – Machine Learning",
			}),
		).toBeHidden();
		await expect(
			page.getByRole("heading", { name: "Part-Time Frontend Developer" }),
		).toBeVisible();
	});
});
