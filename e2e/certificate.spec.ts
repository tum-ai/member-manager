import { expect, type Page, test } from "@playwright/test";
import {
	expectAuthenticated,
	expectToast,
	loginAsLocalMember,
} from "./helpers";

// Engagement-certificate + membership-proof regression harness. Runs against the
// real seeded stack (no mocks).
//
// Seed facts this spec relies on (supabase/seed.sql):
//   - "Continue as regular user" logs in as regular-member@example.com
//     (user 00000000-…-0006), an ACTIVE member. The certificate page gates on
//     active membership, so this user can reach it.
//   - That user's latest engagement_certificate_requests row is `rejected`
//     (id 30000000-…-0003), so on first load the submit button is ENABLED (not
//     pending) and no `approved` request exists for them.
//   - The only seeded `approved` engagement request belongs to user 0003
//     (board-lead@example.com), which has NO dev-login button — so the
//     "Download Approved Certificate" path is NOT reachable through the dev
//     logins. We therefore assert that button is HIDDEN for the regular member
//     and cover the real, reachable download flow via the profile-page
//     "Proof of Membership" button instead. See the "membership proof" describe
//     block. (Gap documented in issue #221 report.)

// The whole file is serial: the "empty submission" describe must run before the
// "request" describe submits and flips the shared regular member into the pending
// state. File-level serial guarantees that order regardless of `fullyParallel`.
test.describe.configure({ mode: "serial" });

const CERTIFICATE_ROUTE = "/tools/engagement-certificate";

// Fills the single (first) engagement card with deterministic, valid values.
// Field ids are generated dynamically, so we drive everything through labels /
// roles. Selects are shadcn (radix) comboboxes.
async function fillFirstEngagement(page: Page, tasks: string): Promise<void> {
	await page.getByLabel("Start Date").first().fill("2024-01-15");

	// Weekly Hours is a radix Select exposed with aria-label "Weekly Hours".
	await page.getByRole("combobox", { name: "Weekly Hours" }).first().click();
	await page.getByRole("option", { name: "5 hours", exact: true }).click();

	await page.getByRole("combobox", { name: "Department" }).first().click();
	await page
		.getByRole("option", { name: "Software Development", exact: true })
		.click();

	await page.getByLabel("Tasks / Responsibilities").first().fill(tasks);
}

// Runs FIRST: the serial "request" describe below submits a request for the
// regular member, which flips the page into the pending ("Awaiting Admin
// Review") state for the rest of the run. Empty-form submit-blocking must be
// asserted before that happens, while "Submit for Approval" is still shown.
test.describe("engagement certificate empty submission", () => {
	test("blocks submitting an empty engagement via field validation", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto(CERTIFICATE_ROUTE);

		// Start Date is a native `required` date input, so the browser blocks the
		// submit and the POST is never sent.
		let posted = false;
		page.on("request", (request) => {
			if (
				request.url().includes("/api/engagement-certificates") &&
				request.method() === "POST"
			) {
				posted = true;
			}
		});

		await page.getByRole("button", { name: "Submit for Approval" }).click();

		// Deterministic assertion (no fixed wait): the required Start Date is invalid
		// because it is empty, which is exactly why the browser blocked the submit.
		const startDate = page.getByLabel("Start Date").first();
		await expect
			.poll(() =>
				startDate.evaluate((el) => (el as HTMLInputElement).validity.valid),
			)
			.toBe(false);

		// No certificate request was sent, and we are still on the form.
		expect(posted).toBe(false);
		await expect(
			page.getByRole("heading", { name: "Engagement #1" }),
		).toBeVisible();
	});
});

test.describe("engagement certificate request", () => {
	// Submit progresses the regular member's latest request to `pending`, which
	// then disables the submit button. Keep these ordered so the pending-state
	// assertions observe the state this same describe produced.
	test.describe.configure({ mode: "serial" });

	test("end date toggles with the still-active checkbox", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto(CERTIFICATE_ROUTE);

		await expect(
			page.getByRole("heading", { name: "Engagement #1" }),
		).toBeVisible();

		// Default state: still-active is unchecked, so the End Date field renders.
		const stillActive = page
			.getByLabel("I am still active in this role")
			.first();
		await expect(page.getByLabel("End Date").first()).toBeVisible();

		// Checking "still active" removes the End Date field.
		await stillActive.click();
		await expect(page.getByLabel("End Date")).toHaveCount(0);

		// Unchecking brings it back.
		await stillActive.click();
		await expect(page.getByLabel("End Date").first()).toBeVisible();
	});

	test("submits an engagement for approval and reflects the pending state", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto(CERTIFICATE_ROUTE);

		const tasks = `E2E engagement tasks ${Date.now()}`;

		// "Still active" so we don't need an End Date.
		await page.getByLabel("I am still active in this role").first().click();
		await fillFirstEngagement(page, tasks);

		// Wait on the real POST so the assertion reflects server state.
		const submitted = page.waitForResponse(
			(r) =>
				r.url().includes("/api/engagement-certificates") &&
				r.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Submit for Approval" }).click();
		const response = await submitted;
		expect(response.ok()).toBe(true);

		await expectToast(
			page,
			"Certificate request submitted for admin approval.",
		);

		// The submit button flips to the awaiting state and disables once the
		// refetched request list shows the new `pending` request as the latest.
		const awaiting = page.getByRole("button", {
			name: "Awaiting Admin Review",
		});
		await expect(awaiting).toBeVisible();
		await expect(awaiting).toBeDisabled();
	});

	test("renders the pending status badge and disabled submit after reload", async ({
		page,
	}) => {
		// By now the regular member's latest request is `pending` (produced by the
		// preceding serial test). A fresh load must reflect that.
		await loginAsLocalMember(page);
		await page.goto(CERTIFICATE_ROUTE);

		await expect(
			page.getByText("Current request status: pending"),
		).toBeVisible();

		await expect(
			page.getByRole("button", { name: "Awaiting Admin Review" }),
		).toBeDisabled();
	});
});

test.describe("engagement certificate validation", () => {
	test("adds and removes engagements within the 1..5 bounds", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto(CERTIFICATE_ROUTE);

		// A single engagement has no remove control (canRemove is false).
		await expect(
			page.getByRole("heading", { name: "Engagement #1" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Remove engagement 1" }),
		).toHaveCount(0);

		const addButton = page.getByRole("button", {
			name: "Add Another Engagement",
		});

		// Grow to the max of 5; each click appends one fieldset.
		for (let count = 2; count <= 5; count++) {
			await addButton.click();
			await expect(
				page.getByRole("heading", { name: `Engagement #${count}` }),
			).toBeVisible();
		}

		// At 5 the add button is disabled (the hook also raises a max warning, but
		// the disabled control is the user-facing guard we can assert without a
		// race).
		await expect(addButton).toBeDisabled();

		// Removing a non-last engagement now works (canRemove is true for >1).
		await page.getByRole("button", { name: "Remove engagement 5" }).click();
		await expect(
			page.getByRole("heading", { name: "Engagement #5" }),
		).toHaveCount(0);
		await expect(addButton).toBeEnabled();
	});
});

test.describe("membership proof download", () => {
	// "Download membership proof" maps to the profile page's "Proof of
	// Membership" button (useMembershipProof → generateMembershipProofPdf →
	// downloadPdfBlob). On desktop Chromium downloadPdfBlob clicks an anchor with
	// a `download` attribute, which Playwright surfaces as a real download event.
	test("downloads the membership proof PDF and toasts success", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await expectAuthenticated(page);

		// Profile is the index route ("/"); loginAsLocalMember already lands here.
		const proofButton = page.getByRole("button", {
			name: "Proof of Membership",
		});
		await expect(proofButton).toBeVisible();
		await expect(proofButton).toBeEnabled();

		const download = page.waitForEvent("download");
		await proofButton.click();

		const file = await download;
		expect(file.suggestedFilename()).toContain("TUMai_Membership_Proof_");
		expect(file.suggestedFilename()).toMatch(/\.pdf$/);

		await expectToast(page, "Membership proof downloaded!");
	});

	test("hides the approved-certificate download for a member without an approved request", async ({
		page,
	}) => {
		// The seeded approved engagement request belongs to user 0003, which has no
		// dev login. The regular member only has a rejected request, so the
		// approved-download button must not render. This documents the coverage gap
		// for the engagement "Download Approved Certificate" path (issue #221).
		await loginAsLocalMember(page);
		await page.goto(CERTIFICATE_ROUTE);

		await expect(
			page.getByRole("heading", { name: "Engagement #1" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Download Approved Certificate" }),
		).toHaveCount(0);
	});
});
