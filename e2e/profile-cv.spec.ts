import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// The profile CV panel (CvPanel via useMemberCv) starts at "No CV on record yet"
// for the seeded regular member, uploads a PDF via POST /api/members/:id/cv, and
// then offers a download of the current version
// (GET /api/members/:id/cv/current/download). Reuse the valid PDF fixture so the
// server's magic-byte validation passes.
const CV_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

test("a member uploads a CV and downloads it back", async ({ page }) => {
	await loginAsLocalMember(page);
	await page.goto("/");

	// Scope to the CV card (CvPanel renders with id="cv") so the file-input and
	// download selectors can't collide with a future avatar/photo uploader.
	const cvCard = page.locator("#cv");
	await expect(
		cvCard.getByRole("heading", { name: "CV", exact: true }),
	).toBeVisible();

	// Note: we intentionally do NOT assert the "No CV on record yet" empty state.
	// E2E global-setup verifies the seed but does NOT reset the shared local DB
	// between runs, so a prior run may have left a CV for this member. Uploading
	// always creates a new current version, so the post-upload assertions below
	// hold whether or not a CV already existed. The hidden file input is set
	// directly, so we also avoid depending on the "Upload CV" vs "Replace CV"
	// button label.
	//
	// The file input is hidden and ref-driven; set it directly and await the
	// upload POST that persists the new version.
	const uploaded = page.waitForResponse(
		(response) =>
			/\/api\/members\/[^/]+\/cv$/.test(response.url()) &&
			response.request().method() === "POST",
	);
	await cvCard.locator('input[type="file"]').setInputFiles(CV_FIXTURE);
	const uploadResponse = await uploaded;
	expect(uploadResponse.status()).toBe(201);

	await expectToast(
		page,
		"Your new CV is now the current version. Future partner snapshots will use this version.",
	);

	// The current-CV card now shows the member-upload source badge and filename.
	await expect(cvCard.getByText("Uploaded by you")).toBeVisible();
	await expect(cvCard.getByText("receipt.pdf", { exact: true })).toBeVisible();

	// Downloading the current version emits a browser download named after the
	// stored original filename.
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		cvCard.getByRole("button", { name: "Download" }).click(),
	]);
	expect(download.suggestedFilename()).toBe("receipt.pdf");
});
