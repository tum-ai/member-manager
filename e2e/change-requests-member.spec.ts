import { expect, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// The member-facing role/department/status change request form lives on the
// profile page (route "/") for non-admin users (see ProfilePage ->
// RoleChangeRequestSection). The seeded regular member (user 006) has no
// department and a single seeded REJECTED request, so on a fresh seed the
// latest-request summary reads "Rejected". The assertions below are re-run-safe
// regardless (the API returns the newest request first, so the request created
// here keeps "Pending" on top even when a prior run's pending request persists).

async function gotoProfileRequestSection(page: Page): Promise<void> {
	await loginAsLocalMember(page);
	await page.goto("/");
	await expect(
		page.getByRole("heading", {
			name: "Request role, department, or status changes",
		}),
	).toBeVisible();
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

		// The newest request is returned first by the API, so the summary flips to
		// "Pending".
		await expect(page.getByText("Latest request: Pending")).toBeVisible();

		// Reloading the profile re-fetches the list; the pending request persists.
		await page.reload();
		await expect(
			page.getByRole("heading", {
				name: "Request role, department, or status changes",
			}),
		).toBeVisible();
		await expect(page.getByText("Latest request: Pending")).toBeVisible();
	});
});
