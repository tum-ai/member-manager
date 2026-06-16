import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalAdmin, loginAsLocalMember } from "./helpers";

const RECEIPT_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

// End-to-end reimbursement lifecycle across two roles: a regular member submits
// a request, then an admin (who inherits finance.review) approves it. A unique
// description correlates the two halves so the test stays deterministic even if
// the shared stack already holds seeded requests.
test("member submits a reimbursement and an admin approves it", async ({
	browser,
}) => {
	const description = `E2E reimbursement ${Date.now()}`;

	// --- Member submits ----------------------------------------------------
	const memberContext = await browser.newContext();
	const memberPage = await memberContext.newPage();
	await loginAsLocalMember(memberPage);
	await memberPage.goto("/tools/reimbursement");

	await expect(
		memberPage.getByRole("heading", { name: "New request" }),
	).toBeVisible();

	// The file input is visually hidden but still settable; uploading triggers an
	// optional receipt-parse call that may 503 in CI (no OPENAI_API_KEY) — that is
	// handled gracefully by the page and does not block submission. On success it
	// would overwrite the fields we type below, so wait for the parse call to
	// settle (any status) BEFORE filling, keeping our deterministic values the
	// ones that get submitted.
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

	// Department is a shadcn Select; open it and pick a stable option.
	await memberPage.getByRole("combobox", { name: "Department" }).click();
	await memberPage
		.getByRole("option", { name: "Software Development" })
		.click();

	await memberPage.getByLabel("Description").fill(description);

	// IBAN/BIC are prefilled from the member's seeded SEPA details, but set them
	// explicitly so the test does not depend on that prefill timing.
	await memberPage.getByLabel("IBAN").fill("DE89370400440532013000");
	await memberPage.getByLabel("BIC").fill("COBADEFFXXX");

	await memberPage.getByRole("button", { name: /submit request/i }).click();
	await expectToast(memberPage, /reimbursement request submitted/i);

	// The new request shows up in the member's own list (description is rendered
	// verbatim in the request card).
	await expect(memberPage.getByText(description).first()).toBeVisible();

	await memberContext.close();

	// --- Admin approves ----------------------------------------------------
	const adminContext = await browser.newContext();
	const adminPage = await adminContext.newPage();
	await loginAsLocalAdmin(adminPage);
	await adminPage.goto("/tools/reimbursement/review");

	await expect(
		adminPage.getByRole("heading", { name: "Finance Review" }),
	).toBeVisible();

	// Narrow the queue to our request via the search box, then expand the single
	// matching accordion item (its trigger's accessible name contains the
	// description alongside badges/amount, so match on a substring).
	await adminPage.getByLabel("Search reimbursement queue").fill(description);

	const queueItem = adminPage.getByRole("button", {
		name: new RegExp(description),
	});
	await expect(queueItem).toBeVisible();
	await queueItem.click();

	// Approve and assert the state transition both via toast and the stage badge
	// flipping from "Needs approval" to "Ready for payment".
	await adminPage.getByRole("button", { name: "Approve" }).click();
	await expectToast(adminPage, /reimbursement request updated/i);

	await expect(adminPage.getByText("Ready for payment").first()).toBeVisible();

	await adminContext.close();
});
