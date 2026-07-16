import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalAdmin, loginAsLocalMember } from "./helpers";

// Seeded APPROVED member job postings that are published on the board (see
// supabase/seed.sql `job_posting_requests`). Two carry an external apply URL;
// the robotics thesis intentionally has none, so its apply CTA is a mailto.
const APPROVED_EXTERNAL_JOB = {
	title: "AI Research Internship (6 months)",
	organization: "DeepLab Research",
	contactName: "Jonas Lead",
	externalUrl: "https://deeplab.example/internships",
	descriptionFragment: "Work on applied LLM research",
} as const;

const APPROVED_MAILTO_JOB = {
	title: "Master Thesis – Robotics Perception",
	organization: "TUM Robotics Lab",
	contactEmail: "thesis@robotics.tum.example",
	callToAction: "Get in touch",
	descriptionFragment: "Develop perception models",
} as const;

test.describe("job board", () => {
	test("browses approved postings and opens a detail dialog", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		await expect(
			page.getByRole("heading", { level: 1, name: "Job Board" }),
		).toBeVisible();

		// Seeded approved postings render as cards (the card title is an <h2>).
		await expect(
			page.getByRole("heading", { name: APPROVED_EXTERNAL_JOB.title }).first(),
		).toBeVisible();
		await expect(
			page.getByText(APPROVED_EXTERNAL_JOB.organization).first(),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: APPROVED_MAILTO_JOB.title }).first(),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Full-Time ML Engineer" }).first(),
		).toBeVisible();

		// Each card exposes a "View details for <title>" button that opens the
		// detail dialog. Open it via click and assert the description + meta render.
		await page
			.getByRole("button", {
				name: `View details for ${APPROVED_EXTERNAL_JOB.title}`,
			})
			.click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByText(APPROVED_EXTERNAL_JOB.descriptionFragment),
		).toBeVisible();
		await expect(
			dialog.getByText(`Contact: ${APPROVED_EXTERNAL_JOB.contactName}`, {
				exact: false,
			}),
		).toBeVisible();
	});

	test("opens a posting detail dialog via keyboard activation", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		// The "Read more" trigger is a native button; focus it and activate with
		// Enter, then re-open with Space to cover both keyboard paths.
		const detailsTrigger = page.getByRole("button", {
			name: `View details for ${APPROVED_MAILTO_JOB.title}`,
		});
		await expect(detailsTrigger).toBeVisible();

		await detailsTrigger.focus();
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByText(APPROVED_MAILTO_JOB.descriptionFragment),
		).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();

		await detailsTrigger.focus();
		await page.keyboard.press(" ");
		await expect(page.getByRole("dialog")).toBeVisible();
	});

	test("renders an external apply link with a safe new-tab target", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		await page
			.getByRole("button", {
				name: `View details for ${APPROVED_EXTERNAL_JOB.title}`,
			})
			.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();

		// Posting WITH external_url: the CTA is an anchor opening a new tab. Assert
		// href/target/rel and the call-to-action label — do NOT navigate it.
		const applyLink = dialog.getByRole("link", { name: /apply now/i });
		await expect(applyLink).toHaveAttribute(
			"href",
			APPROVED_EXTERNAL_JOB.externalUrl,
		);
		await expect(applyLink).toHaveAttribute("target", "_blank");
		await expect(applyLink).toHaveAttribute("rel", "noopener noreferrer");
	});

	test("renders a mailto apply link for a posting without an external url", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		await page
			.getByRole("button", {
				name: `View details for ${APPROVED_MAILTO_JOB.title}`,
			})
			.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();

		// Posting WITHOUT external_url: the CTA falls back to a mailto link using
		// the contact email and the seeded call-to-action label.
		const contactLink = dialog.getByRole("link", {
			name: new RegExp(APPROVED_MAILTO_JOB.callToAction, "i"),
		});
		await expect(contactLink).toHaveAttribute(
			"href",
			`mailto:${APPROVED_MAILTO_JOB.contactEmail}`,
		);
		// A mailto link must not open a new tab.
		await expect(contactLink).not.toHaveAttribute("target", "_blank");
	});
});

test.describe("job submission", () => {
	test("requires all mandatory fields before submitting", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		await page.getByRole("button", { name: "Post job" }).click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByRole("heading", { name: "Post a job" }),
		).toBeVisible();

		// Submit with the required fields empty: native required validation blocks
		// the POST, so the dialog stays open and no toast appears.
		let postFired = false;
		page.on("request", (request) => {
			if (
				request.method() === "POST" &&
				request.url().includes("/api/jobs/requests")
			) {
				postFired = true;
			}
		});

		await dialog.getByRole("button", { name: /submit for review/i }).click();

		await expect(
			dialog.getByRole("heading", { name: "Post a job" }),
		).toBeVisible();
		expect(postFired).toBe(false);

		// The first invalid control (Job title) should report invalid.
		const titleInput = dialog.getByLabel("Job title");
		const titleValid = await titleInput.evaluate(
			(node) => (node as HTMLInputElement).validity.valid,
		);
		expect(titleValid).toBe(false);
	});

	test("cancel closes the dialog without submitting", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		await page.getByRole("button", { name: "Post job" }).click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByRole("heading", { name: "Post a job" }),
		).toBeVisible();

		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
	});

	test("submits a job-posting request and lists it as pending", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/tools/jobs");

		const title = `E2E Working Student ${Date.now()}`;

		await page.getByRole("button", { name: "Post job" }).click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByRole("heading", { name: "Post a job" }),
		).toBeVisible();

		await dialog.getByLabel("Job title").fill(title);
		await dialog.getByLabel("Organization").fill("E2E Test Org");

		// Job type is a shadcn Select; open it and pick a stable option.
		await dialog.getByRole("combobox", { name: "Job type" }).click();
		await page.getByRole("option", { name: "Internship" }).click();

		await dialog.getByLabel("Location").fill("Munich, Germany");
		await dialog
			.getByLabel("Description")
			.fill(
				"A deterministic end-to-end job posting submitted by the Playwright suite.",
			);
		await dialog.getByLabel("Contact name").fill("E2E Contact");
		await dialog.getByLabel("Contact email").fill("e2e-contact@example.com");

		// Wait on the POST that persists the request before asserting UI state.
		const submitted = page.waitForResponse(
			(response) =>
				response.url().includes("/api/jobs/requests") &&
				response.request().method() === "POST",
		);
		await dialog.getByRole("button", { name: /submit for review/i }).click();
		const response = await submitted;
		expect(response.status()).toBe(201);

		await expectToast(page, "Job submitted for admin review.");

		// The new submission appears in the member's submissions list with a
		// "pending" status badge (status is rendered verbatim, capitalized via CSS).
		// Scope the badge to the row that contains the unique title so it does not
		// match any other pending submission already owned by the member.
		const submissionRow = page
			.locator("div")
			.filter({ hasText: title })
			.filter({ has: page.getByText("pending") })
			.last();
		await expect(submissionRow).toBeVisible();
		await expect(submissionRow.getByText("pending")).toBeVisible();
	});

	test("submitted request reaches the admin pending queue", async ({
		browser,
	}) => {
		const title = `E2E Cross-Role Job ${Date.now()}`;

		// --- Member submits ----------------------------------------------------
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
		await dialog.getByLabel("Organization").fill("Cross-Role Org");
		await dialog.getByRole("combobox", { name: "Job type" }).click();
		await memberPage.getByRole("option", { name: "Full-time" }).click();
		await dialog.getByLabel("Location").fill("Remote (EU)");
		await dialog
			.getByLabel("Description")
			.fill(
				"Cross-role persistence check: a member submission must surface in the admin queue.",
			);
		await dialog.getByLabel("Contact name").fill("Cross Role");
		await dialog.getByLabel("Contact email").fill("cross-role@example.com");

		const submitted = memberPage.waitForResponse(
			(response) =>
				response.url().includes("/api/jobs/requests") &&
				response.request().method() === "POST",
		);
		await dialog.getByRole("button", { name: /submit for review/i }).click();
		await submitted;
		await expectToast(memberPage, "Job submitted for admin review.");

		await memberContext.close();

		// --- Admin sees it in the pending queue --------------------------------
		const adminContext = await browser.newContext();
		const adminPage = await adminContext.newPage();
		await loginAsLocalAdmin(adminPage);
		await adminPage.goto("/admin/job-requests");

		await expect(
			adminPage.getByRole("heading", { name: "Job Postings" }),
		).toBeVisible();

		// The pending review card renders the posting title as an <h2>.
		await expect(adminPage.getByRole("heading", { name: title })).toBeVisible();

		await adminContext.close();
	});
});
