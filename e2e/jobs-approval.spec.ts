import { expect, test } from "@playwright/test";
import { loginAsLocalAdmin, loginAsLocalMember } from "./helpers";

// Full publish loop: a member submits a job posting (POST /api/jobs/requests),
// an admin approves it from the review queue (PATCH /api/admin/job-requests/:id),
// and the now-approved posting surfaces on the public Job Board (GET /api/jobs)
// for the member. jobs.spec.ts already covers submit + queue visibility; this
// adds the approve -> public-board half. Two browser contexts keep the member
// and admin sessions independent.

test("a member's job posting is published after an admin approves it", async ({
	browser,
}) => {
	const title = `E2E Publish ${Date.now()}`;

	// --- Member submits ------------------------------------------------------
	const memberContext = await browser.newContext();
	const memberPage = await memberContext.newPage();
	await loginAsLocalMember(memberPage);
	await memberPage.goto("/tools/jobs");

	await memberPage.getByRole("button", { name: "Post job" }).click();
	const dialog = memberPage.getByRole("dialog");
	await expect(
		dialog.getByRole("heading", { name: "Post a job" }),
	).toBeVisible();

	await dialog.getByLabel("Job title").fill(title);
	await dialog.getByLabel("Organization").fill("Publish Loop Org");
	await dialog.getByRole("combobox", { name: "Job type" }).click();
	await memberPage.getByRole("option", { name: "Internship" }).click();
	await dialog.getByLabel("Location").fill("Munich, Germany");
	await dialog
		.getByLabel("Description")
		.fill("Publish-loop check: this posting must reach the public board.");
	await dialog.getByLabel("Contact name").fill("Publish Loop");
	await dialog.getByLabel("Contact email").fill("publish-loop@example.com");

	const submitted = memberPage.waitForResponse(
		(response) =>
			response.url().includes("/api/jobs/requests") &&
			response.request().method() === "POST",
	);
	await dialog.getByRole("button", { name: /submit for review/i }).click();
	const submitResponse = await submitted;
	expect(submitResponse.status()).toBe(201);

	// --- Admin approves ------------------------------------------------------
	const adminContext = await browser.newContext();
	const adminPage = await adminContext.newPage();
	await loginAsLocalAdmin(adminPage);
	await adminPage.goto("/admin/job-requests");

	await expect(
		adminPage.getByRole("heading", { name: "Job Posting Requests" }),
	).toBeVisible();

	// Locate the pending review card by its unique title (rendered as an <h2>),
	// then approve it. The Approve button's accessible name includes the
	// requester's display name (shared across a member's requests), so scope the
	// click to this posting's card. The card root is a GlassCard
	// (data-slot="glass-card") containing the unique title heading.
	const reviewCard = adminPage
		.locator('[data-slot="glass-card"]')
		.filter({ has: adminPage.getByRole("heading", { name: title }) });
	await expect(reviewCard).toBeVisible();

	const approved = adminPage.waitForResponse(
		(response) =>
			/\/api\/admin\/job-requests\//.test(response.url()) &&
			response.request().method() === "PATCH",
	);
	await reviewCard
		.getByRole("button", { name: /^Approve job posting request for/ })
		.click();
	const approveResponse = await approved;
	expect(approveResponse.status()).toBe(200);

	await adminContext.close();

	// --- Member sees it on the public board ----------------------------------
	await memberPage.goto("/tools/jobs");
	await expect(
		memberPage.getByRole("heading", { level: 1, name: "Job Board" }),
	).toBeVisible();

	// The approved posting now renders as a JobCard (its title is an <h2>).
	await expect(
		memberPage.getByRole("heading", { name: title }).first(),
	).toBeVisible();

	await memberContext.close();
});
