import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// The member-facing role/department/status change request form lives on the
// profile page (route "/") for non-admin users (see ProfilePage ->
// RoleChangeRequestSection). Below the form, every request the member has
// submitted is listed: pending ones under "Pending review", reviewed ones under
// "Reviewed", each newest first. The seeded regular member (user 006) has no
// department and a single seeded REJECTED Team Lead request. Assertions are
// re-run-safe: requests created by earlier runs persist, so they only check
// that the expected entries are present, never exact counts.

async function gotoProfileRequestSection(page: Page): Promise<void> {
	await loginAsLocalMember(page);
	await page.goto("/");
	await expect(
		page.getByRole("heading", {
			name: "Request role, department, or status changes",
		}),
	).toBeVisible();
}

function pendingRequests(page: Page): Locator {
	return page.getByRole("list", { name: "Pending review" });
}

async function submitRequestedRole(page: Page, role: string): Promise<void> {
	await page.getByRole("combobox", { name: "Requested role" }).click();
	await page.getByRole("option", { name: role, exact: true }).click();

	const submitted = page.waitForResponse(
		(response) =>
			response.url().includes("/api/member-change-requests") &&
			response.request().method() === "POST",
	);
	await page.getByRole("button", { name: "Request changes" }).click();
	const response = await submitted;
	expect(response.status()).toBe(201);
	// The form resets after a successful submit; wait for it so the next
	// selection isn't overwritten by the reset.
	await expect(
		page.getByRole("combobox", { name: "Requested role" }),
	).toHaveText("No change");
}

test.describe("member change requests", () => {
	test("submitting with no change selected raises a warning and fires no request", async ({
		page,
	}) => {
		await gotoProfileRequestSection(page);

		// Track the change-request POST: with nothing selected the client guard
		// (useMemberChangeRequestForm) short-circuits before calling the API.
		let posted = false;
		page.on("request", (request) => {
			if (
				request.url().includes("/api/member-change-requests") &&
				request.method() === "POST"
			) {
				posted = true;
			}
		});

		await page.getByRole("button", { name: "Request changes" }).click();

		await expectToast(
			page,
			"Select a role, department, or alumni status change to request.",
		);
		expect(posted).toBe(false);
	});

	test("a department-only change persists as a pending request", async ({
		page,
	}) => {
		await gotoProfileRequestSection(page);

		// A department-only change (no role) is valid server-side: the schema only
		// requires "at least one requested change", and the department-required
		// check applies only when a member_role is also requested.
		await page.getByRole("combobox", { name: "Requested department" }).click();
		await page.getByRole("option", { name: "Research" }).click();

		const submitted = page.waitForResponse(
			(response) =>
				response.url().includes("/api/member-change-requests") &&
				response.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Request changes" }).click();
		const response = await submitted;
		expect(response.status()).toBe(201);

		await expectToast(page, "Change request sent to the admin and LnF team.");

		// The new request shows up under "Pending review".
		const pending = pendingRequests(page);
		await expect(
			pending.getByText("Research", { exact: true }).first(),
		).toBeVisible();
		await expect(
			pending.getByText("Pending", { exact: true }).first(),
		).toBeVisible();

		// Reloading the profile re-fetches the list; the pending request persists.
		await page.reload();
		await expect(
			page.getByRole("heading", {
				name: "Request role, department, or status changes",
			}),
		).toBeVisible();
		await expect(
			pendingRequests(page).getByText("Research", { exact: true }).first(),
		).toBeVisible();
	});

	// Regression for #325: requesting two roles used to show only the newest
	// request, so the first one looked lost.
	test("submitting two role requests lists both of them", async ({ page }) => {
		await gotoProfileRequestSection(page);

		await submitRequestedRole(page, "President");
		await submitRequestedRole(page, "Vice-President");
		await expectToast(page, "Change request sent to the admin and LnF team.");

		const expectBothRoleRequests = async (): Promise<void> => {
			const pending = pendingRequests(page);
			await expect(
				pending.getByText("President", { exact: true }).first(),
			).toBeVisible();
			await expect(
				pending.getByText("Vice-President", { exact: true }).first(),
			).toBeVisible();
			// Older, already-reviewed requests stay listed too.
			await expect(
				page
					.getByRole("list", { name: "Reviewed" })
					.getByText("Rejected", { exact: true })
					.first(),
			).toBeVisible();
		};

		await expectBothRoleRequests();

		await page.reload();
		await expect(
			page.getByRole("heading", {
				name: "Request role, department, or status changes",
			}),
		).toBeVisible();
		await expectBothRoleRequests();
	});
});
