import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { expectToast, loginWithSeedEmail } from "./helpers";

const RECEIPT_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

test("Vivid form stays usable on mobile dark mode", async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ colorScheme: "dark" });
	const description = `E2E mobile Vivid reimbursement ${Date.now()}`;

	await loginWithSeedEmail(page, "makeathon-lead@example.com");
	await page.goto("/tools/reimbursement");
	await expect(page.getByRole("radio", { name: "Vivid" })).toBeVisible();
	await page.getByRole("radio", { name: "Vivid" }).click();
	await expect(page.getByLabel("IBAN")).toHaveCount(0);
	await expect(page.getByLabel("BIC")).toHaveCount(0);

	const parseSettled = page
		.waitForResponse(
			(response) =>
				response.url().includes("/api/reimbursements/parse-receipt"),
			{ timeout: 15_000 },
		)
		.catch(() => undefined);
	await page.getByLabel("Receipt file").setInputFiles(RECEIPT_FIXTURE);
	await parseSettled;
	await page.getByLabel("Amount").fill("8.75");
	await page.getByLabel("Date").fill("2026-06-11");
	await page.getByLabel("Description").fill(description);
	const hasHorizontalOverflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth,
	);
	expect(hasHorizontalOverflow).toBe(false);

	await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
		timeout: 15_000,
	});
	await page
		.getByRole("heading", { name: "New request" })
		.locator("..")
		.locator("..")
		.screenshot({
			path: testInfo.outputPath("vivid-mobile-dark-form.png"),
		});

	const createRequest = page.waitForRequest(
		(request) =>
			request.method() === "POST" &&
			new URL(request.url()).pathname === "/api/reimbursements",
	);
	await page.getByRole("button", { name: /submit request/i }).click();
	const requestBody = (await (await createRequest).postDataJSON()) as Record<
		string,
		unknown
	>;
	expect(requestBody.submission_type).toBe("vivid_reimbursement");
	expect(requestBody).not.toHaveProperty("payment_iban");
	expect(requestBody).not.toHaveProperty("payment_bic");
	await expectToast(page, /reimbursement request submitted/i);
});
