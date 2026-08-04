import { expect, test } from "@playwright/test";
import {
	expectAuthenticated,
	expectToast,
	loginAsLocalAdmin,
	loginWithSeedEmail,
	SEED_EDUCATION_ADMIN_EMAIL,
	SEED_LEGAL_FINANCE_MEMBER_EMAIL,
	SEED_REGULAR_MEMBER_EMAIL,
} from "./helpers";

const EDUCATIONAL_COURSES_ROUTE = "/education/courses";

test("an independent education administrator reviews an application that the participant can see", async ({
	browser,
}) => {
	const applicantContext = await browser.newContext();
	const applicantPage = await applicantContext.newPage();
	await loginWithSeedEmail(applicantPage, SEED_REGULAR_MEMBER_EMAIL);
	await applicantPage.goto(EDUCATIONAL_COURSES_ROUTE);
	await expect(
		applicantPage.getByRole("heading", {
			name: "Educational Course Planning",
		}),
	).toBeVisible();

	const withdrawButton = applicantPage.getByRole("button", {
		name: "Withdraw",
	});
	if (await withdrawButton.isVisible()) {
		const withdrawResponse = applicantPage.waitForResponse(
			(response) =>
				response.url().includes("/api/education/periods/") &&
				response.url().endsWith("/applications/me") &&
				response.request().method() === "DELETE",
		);
		await withdrawButton.click();
		expect((await withdrawResponse).status()).toBe(204);
		const applyResponse = applicantPage.waitForResponse(
			(response) =>
				response.url().includes("/api/education/periods/") &&
				response.url().endsWith("/applications") &&
				response.request().method() === "POST",
		);
		await applicantPage.getByRole("button", { name: "Apply" }).click();
		expect((await applyResponse).status()).toBe(201);
		await expect(applicantPage.getByText("Pending review")).toBeVisible();
	}
	await applicantContext.close();

	const administratorContext = await browser.newContext();
	const administratorPage = await administratorContext.newPage();
	await loginWithSeedEmail(administratorPage, SEED_EDUCATION_ADMIN_EMAIL);
	await administratorPage.goto(EDUCATIONAL_COURSES_ROUTE);
	await expect(
		administratorPage.getByRole("heading", {
			name: "Educational Course Planning",
		}),
	).toBeVisible();
	await expect(
		administratorPage.getByText("Administration", { exact: true }),
	).toBeVisible();

	await administratorPage
		.getByRole("button", { name: "Review applications" })
		.first()
		.click();
	const reviewPanel = administratorPage.getByRole("region", {
		name: "Application review",
	});
	const applicationRow = reviewPanel
		.getByRole("listitem")
		.filter({ hasText: "Regular Member" });
	await expect(applicationRow).toBeVisible();

	const rejectResponse = administratorPage.waitForResponse(
		(response) =>
			response.url().includes("/api/education/applications/") &&
			response.request().method() === "PATCH",
	);
	await applicationRow.getByRole("button", { name: "Reject" }).click();
	expect((await rejectResponse).status()).toBe(200);
	await expect(applicationRow.getByText("Rejected")).toBeVisible();

	const approveResponse = administratorPage.waitForResponse(
		(response) =>
			response.url().includes("/api/education/applications/") &&
			response.request().method() === "PATCH",
	);
	await applicationRow.getByRole("button", { name: "Approve" }).click();
	expect((await approveResponse).status()).toBe(200);
	await expect(applicationRow.getByText("Approved")).toBeVisible();
	await administratorContext.close();

	const participantContext = await browser.newContext();
	const participantPage = await participantContext.newPage();
	await loginWithSeedEmail(participantPage, SEED_REGULAR_MEMBER_EMAIL);
	await participantPage.goto(EDUCATIONAL_COURSES_ROUTE);
	await expect(
		participantPage.getByRole("heading", {
			name: "Educational Course Planning",
		}),
	).toBeVisible();
	await participantPage.getByRole("button", { name: "Community" }).click();
	await expect(
		participantPage.getByRole("link", { name: "Educational Courses" }),
	).toBeVisible();
	await expect(
		participantPage.getByText("Approved", { exact: true }),
	).toBeVisible();
	await expect(
		participantPage.getByText("Regular Member").first(),
	).toBeVisible();
	await participantContext.close();
});

test("a global administrator can appoint seeded members without gaining course access", async ({
	page,
}) => {
	await loginAsLocalAdmin(page);
	await expectAuthenticated(page);
	await page.goto("/admin");
	await expect(
		page.getByRole("heading", { name: "Admin Workspace" }),
	).toBeVisible();

	await page
		.getByRole("textbox", { name: "Add administrator" })
		.fill(SEED_LEGAL_FINANCE_MEMBER_EMAIL);
	const candidate = page
		.getByText(SEED_LEGAL_FINANCE_MEMBER_EMAIL, { exact: true })
		.locator("..")
		.locator("..");
	const assignResponse = page.waitForResponse(
		(response) =>
			response.url().includes("/api/admin/education/administrators/") &&
			response.request().method() === "PUT",
	);
	await candidate.getByRole("button", { name: "Add" }).click();
	expect((await assignResponse).status()).toBe(200);
	await expectToast(page, "Educational course administrator added.");

	const removeResponse = page.waitForResponse(
		(response) =>
			response.url().includes("/api/admin/education/administrators/") &&
			response.request().method() === "DELETE",
	);
	await page
		.getByRole("button", {
			name: "Remove Luca Finance as educational course administrator",
		})
		.click();
	expect((await removeResponse).status()).toBe(204);
	await expectToast(page, "Educational course administrator removed.");

	await expect(
		page.getByRole("link", { name: "Educational Courses" }),
	).toHaveCount(0);

	await page.goto(EDUCATIONAL_COURSES_ROUTE);
	await expect(page).toHaveURL(/\/$/);
});
