import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalAdmin, loginWithSeedEmail } from "./helpers";

const RECEIPT_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

test("eligible team lead submits a Vivid expense for finance review", async ({
	browser,
}, testInfo) => {
	const description = `E2E Vivid reimbursement ${Date.now()}`;
	const memberContext = await browser.newContext({
		viewport: { width: 1280, height: 1100 },
	});
	const memberPage = await memberContext.newPage();

	try {
		await loginWithSeedEmail(memberPage, "makeathon-lead@example.com");
		await memberPage.goto("/tools/reimbursement");

		await expect(
			memberPage.getByRole("heading", { name: "New request" }),
		).toBeVisible();
		await expect(
			memberPage.getByRole("radio", { name: "Vivid" }),
		).toBeVisible();
		await memberPage.getByRole("radio", { name: "Vivid" }).click();
		await expect(memberPage.getByLabel("IBAN")).toHaveCount(0);
		await expect(memberPage.getByLabel("BIC")).toHaveCount(0);

		const parseSettled = memberPage
			.waitForResponse(
				(response) =>
					response.url().includes("/api/reimbursements/parse-receipt"),
				{ timeout: 15_000 },
			)
			.catch(() => undefined);
		await memberPage.getByLabel("Receipt file").setInputFiles(RECEIPT_FIXTURE);
		await parseSettled;

		await memberPage.getByLabel("Amount").fill("23.45");
		await memberPage.getByLabel("Date").fill("2026-06-10");
		await memberPage.getByLabel("Description").fill(description);
		await expect(
			memberPage.getByRole("combobox", { name: "Department" }),
		).toContainText("Makeathon");

		await expect(memberPage.locator("[data-sonner-toast]")).toHaveCount(0, {
			timeout: 15_000,
		});
		await memberPage.locator("form").screenshot({
			path: testInfo.outputPath("vivid-desktop-form.png"),
		});

		const createRequest = memberPage.waitForRequest(
			(request) =>
				request.method() === "POST" &&
				new URL(request.url()).pathname === "/api/reimbursements",
		);
		await memberPage.getByRole("button", { name: /submit request/i }).click();
		const requestBody = (await (await createRequest).postDataJSON()) as Record<
			string,
			unknown
		>;
		expect(requestBody.submission_type).toBe("vivid_reimbursement");
		expect(requestBody).not.toHaveProperty("payment_iban");
		expect(requestBody).not.toHaveProperty("payment_bic");
		await expectToast(memberPage, /reimbursement request submitted/i);

		const adminContext = await browser.newContext();
		const adminPage = await adminContext.newPage();
		try {
			await loginAsLocalAdmin(adminPage);
			await adminPage.goto("/tools/reimbursement/review");
			await expect(
				adminPage.getByRole("heading", { name: "Finance Review" }),
			).toBeVisible();
			await adminPage
				.getByLabel("Search reimbursement queue")
				.fill(description);

			const queueItem = adminPage.getByRole("button", {
				name: new RegExp(description),
			});
			await expect(queueItem).toBeVisible();
			await queueItem.click();
			await expect(
				adminPage.getByText("Needs approval", { exact: true }).first(),
			).toBeVisible();
			await expect(
				adminPage.getByText("Vivid Reimbursement").first(),
			).toBeVisible();
			await expect(adminPage.getByText("IBAN", { exact: true })).toHaveCount(0);
			await expect(adminPage.getByText("BIC", { exact: true })).toHaveCount(0);

			await adminPage
				.getByRole("button", { name: "Approve", exact: true })
				.click();
			await expectToast(adminPage, /reimbursement request updated/i);
			await expect(
				adminPage.getByText("No payment required").first(),
			).toBeVisible();
			await expect(
				adminPage.getByRole("button", { name: /mark paid/i }),
			).toHaveCount(0);
			await adminPage.getByRole("button", { name: /^Closed/ }).click();
			await expect(queueItem).toBeVisible();
		} finally {
			await adminContext.close();
		}
	} finally {
		if (memberContext.pages().length) {
			await memberContext.close();
		}
	}
});
