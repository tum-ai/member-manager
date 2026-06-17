import { expect, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// The footer "Report a bug" button (BugReportButton) opens a dialog that POSTs
// to /api/bug-reports. The server route only resolves successfully when a GitHub
// issue creator is installed; locally the dev-only stub
// (installLocalBugReportStub, gated by isLocalAdminBootstrapEnabled) returns a
// fake issue without any network call, so the 202 success path is exercisable.

test.describe("bug report dialog", () => {
	test("blocks an empty / too-short message before any request", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		// Track the bug-report POST: a message under 5 chars keeps the submit
		// button disabled, so no request is ever fired.
		let posted = false;
		page.on("request", (request) => {
			if (
				request.url().includes("/api/bug-reports") &&
				request.method() === "POST"
			) {
				posted = true;
			}
		});

		await page.getByRole("button", { name: "Report a bug" }).click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByRole("heading", { name: "Report a bug" }),
		).toBeVisible();

		const submit = dialog.getByRole("button", { name: "Send report" });
		await expect(submit).toBeDisabled();

		// Four characters is still below the minimum of five.
		await dialog.getByLabel("What went wrong?").fill("bug");
		await expect(submit).toBeDisabled();

		expect(posted).toBe(false);
	});

	test("submits a valid bug report and shows the success toast", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		await page.getByRole("button", { name: "Report a bug" }).click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByRole("heading", { name: "Report a bug" }),
		).toBeVisible();

		await dialog
			.getByLabel("What went wrong?")
			.fill("Profile save button does nothing after editing my department.");
		await dialog
			.getByLabel("Steps to reproduce (optional)")
			.fill("Open profile, change department, click Save.");

		const submitted = page.waitForResponse(
			(response) =>
				response.url().includes("/api/bug-reports") &&
				response.request().method() === "POST",
		);
		await dialog.getByRole("button", { name: "Send report" }).click();
		const response = await submitted;
		expect(response.status()).toBe(202);

		await expectToast(page, "Bug report sent. Thanks for flagging it.");
		await expect(page.getByRole("dialog")).toBeHidden();
	});
});
