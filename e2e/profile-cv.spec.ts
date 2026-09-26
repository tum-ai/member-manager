import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// The profile CV panel (CvPanel via useMemberCv) starts at "No CV on record yet"
// for the seeded regular member, uploads a PDF via POST /api/members/:id/cv, and
// then offers a download of the current version
// (GET /api/members/:id/cv/current/download). Reuse the valid PDF fixture so the
// server's magic-byte validation passes.
const CV_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);
// A second, byte-distinct valid PDF used to replace the first one (#303).
const CV_REPLACEMENT_FIXTURE = fileURLToPath(
	new URL("./fixtures/cv-replacement.pdf", import.meta.url),
);

async function uploadCv(
	page: Page,
	cvCard: Locator,
	fixturePath: string,
): Promise<void> {
	const uploaded = page.waitForResponse(
		(response) =>
			/\/api\/members\/[^/]+\/cv$/.test(response.url()) &&
			response.request().method() === "POST",
	);
	await cvCard.locator('input[type="file"]').setInputFiles(fixturePath);
	const uploadResponse = await uploaded;
	expect(uploadResponse.status()).toBe(201);
}

async function downloadCurrentCv(
	page: Page,
	cvCard: Locator,
): Promise<{ filename: string; bytes: Buffer }> {
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		cvCard.getByRole("button", { name: "Download" }).click(),
	]);
	return {
		filename: download.suggestedFilename(),
		bytes: await readFile(await download.path()),
	};
}

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
	await uploadCv(page, cvCard, CV_FIXTURE);

	await expectToast(
		page,
		"Your new CV is now the current version. Future partner snapshots will use this version.",
	);

	// The current-CV card now shows the member-upload source badge and filename.
	await expect(cvCard.getByText("Uploaded by you")).toBeVisible();
	await expect(cvCard.getByText("receipt.pdf", { exact: true })).toBeVisible();

	// Downloading the current version emits a browser download named after the
	// stored original filename.
	const download = await downloadCurrentCv(page, cvCard);
	expect(download.filename).toBe("receipt.pdf");
});

// Regression for #303: after replacing a CV, the card showed the new filename
// but Download still returned the old file, because the browser reused a cached
// response for the stable "current" download URL. Download once to warm any
// cache, replace, then assert the second download carries the new bytes.
test("replacing a CV downloads the new file, not the previous one", async ({
	page,
}) => {
	const originalBytes = await readFile(CV_FIXTURE);
	const replacementBytes = await readFile(CV_REPLACEMENT_FIXTURE);
	expect(replacementBytes.equals(originalBytes)).toBe(false);

	await loginAsLocalMember(page);
	await page.goto("/");

	const cvCard = page.locator("#cv");
	await expect(
		cvCard.getByRole("heading", { name: "CV", exact: true }),
	).toBeVisible();

	// A prior run may already have left a CV for this member (see above), so
	// only rely on state this test creates.
	await uploadCv(page, cvCard, CV_FIXTURE);
	await expect(cvCard.getByText("receipt.pdf", { exact: true })).toBeVisible();

	const first = await downloadCurrentCv(page, cvCard);
	expect(first.filename).toBe("receipt.pdf");
	expect(first.bytes.equals(originalBytes)).toBe(true);

	await uploadCv(page, cvCard, CV_REPLACEMENT_FIXTURE);
	// Wait for the metadata refetch so the card reflects the new version.
	await expect(
		cvCard.getByText("cv-replacement.pdf", { exact: true }),
	).toBeVisible();

	const second = await downloadCurrentCv(page, cvCard);
	expect(second.filename).toBe("cv-replacement.pdf");
	expect(
		second.bytes.equals(replacementBytes),
		"downloaded bytes must be the replacement CV, not the cached original",
	).toBe(true);
});
