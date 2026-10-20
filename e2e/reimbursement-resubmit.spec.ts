import { fileURLToPath } from "node:url";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalAdmin, loginAsLocalMember } from "./helpers";

const RECEIPT_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

async function openReviewItem(
	browser: Browser,
	description: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await loginAsLocalAdmin(page);
	await page.goto("/tools/reimbursement/review");
	await page.getByLabel("Search reimbursement queue").fill(description);
	const queueItem = page.getByRole("button", { name: new RegExp(description) });
	await expect(queueItem).toBeVisible();
	await queueItem.click();
	return { page, close: () => context.close() };
}

// A rejected request is fixed and sent back on the same row: the member sees
// the reason, edits the request in place, and the reviewer gets it back as a
// pending request that shows what it was rejected for.
test("member fixes a rejected reimbursement and resubmits the same request", async ({
	browser,
}) => {
	const description = `E2E resubmit ${Date.now()}`;
	const reason = "Please attach the itemised receipt";

	// --- Member submits ----------------------------------------------------
	const memberContext = await browser.newContext();
	const memberPage = await memberContext.newPage();
	await loginAsLocalMember(memberPage);
	await memberPage.goto("/tools/reimbursement");

	// Wait for the optional receipt parse to settle before typing, so a
	// successful parse can't overwrite the values below.
	const parseSettled = memberPage
		.waitForResponse(
			(r) => r.url().includes("/api/reimbursements/parse-receipt"),
			{ timeout: 15_000 },
		)
		.catch(() => undefined);
	await memberPage.getByLabel("Receipt file").setInputFiles(RECEIPT_FIXTURE);
	await parseSettled;
	await memberPage.getByLabel("Amount").fill("23.45");
	await memberPage.getByLabel("Date").fill("2026-06-10");
	await memberPage.getByRole("combobox", { name: "Department" }).click();
	await memberPage
		.getByRole("option", { name: "Software Development" })
		.click();
	await memberPage.getByLabel("Description").fill(description);
	await memberPage.getByLabel("IBAN").fill("DE89370400440532013000");
	await memberPage.getByLabel("BIC").fill("COBADEFFXXX");
	await memberPage.getByRole("button", { name: /submit request/i }).click();
	await expectToast(memberPage, /reimbursement request submitted/i);

	// --- Admin rejects -----------------------------------------------------
	const firstReview = await openReviewItem(browser, description);
	await firstReview.page.getByRole("button", { name: "Reject" }).click();
	await firstReview.page.getByLabel("Rejection reason").fill(reason);
	await firstReview.page
		.getByRole("button", { name: "Confirm rejection" })
		.click();
	await expect(firstReview.page.getByText("Rejected").first()).toBeVisible();
	await firstReview.close();

	// --- Member edits and resubmits ------------------------------------------
	await memberPage.reload();
	const card = memberPage
		.getByRole("button", { name: /view details for/i })
		.filter({ hasText: description });
	await expect(card).toContainText(reason);
	await card.click();

	const detail = memberPage.getByRole("dialog", {
		name: "Reimbursement request",
	});
	await expect(detail.getByText(reason)).toBeVisible();
	await detail.getByRole("button", { name: "Edit and resubmit" }).click();
	await expect(detail).toBeHidden();

	const editHeading = memberPage.getByRole("heading", {
		name: "Edit rejected request",
	});
	await expect(editHeading).toBeFocused();
	await expect(memberPage.getByText(reason).last()).toBeVisible();
	await expect(memberPage.getByLabel("Description")).toHaveValue(description);
	// The receipt already on the request is kept unless replaced.
	await expect(memberPage.getByText("receipt.pdf").first()).toBeVisible();

	await memberPage.getByLabel("Amount").fill("19.99");
	await memberPage.getByRole("button", { name: "Resubmit request" }).click();
	await expectToast(memberPage, /request resubmitted for review/i);
	await expect(
		memberPage.getByRole("heading", { name: "New request" }),
	).toBeVisible();

	// Same request, back to pending, no second card.
	await expect(card).toHaveCount(1);
	await expect(card).toContainText("Pending");
	await expect(card).toContainText("Resubmitted");
	await expect(card).not.toContainText(reason);
	await memberContext.close();

	// --- Admin sees the resubmission -----------------------------------------
	const secondReview = await openReviewItem(browser, description);
	await expect(
		secondReview.page.getByText("Needs approval").first(),
	).toBeVisible();
	await expect(
		secondReview.page.getByText("Resubmitted").first(),
	).toBeVisible();
	await expect(
		secondReview.page.getByText(`Previously rejected: ${reason}`),
	).toBeVisible();
	await expect(
		secondReview.page.getByRole("button", { name: "Approve", exact: true }),
	).toBeVisible();
	await secondReview.close();
});
