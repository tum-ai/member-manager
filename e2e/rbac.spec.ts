import { expect, type Page, test } from "@playwright/test";
import { loginAsLocalAdmin, loginAsLocalMember } from "./helpers";

// Admin-only routes and the heading each renders when access is granted. A
// regular member is redirected to "/" (the profile) by the client guards in
// App.tsx (`adminRoute` / `RequirePermission`), NOT shown a 403 page. The
// positive control (admin) proves each block is role-based, not a dead route.
const GATED_ROUTES = [
	{ path: "/admin", heading: "Admin Workspace" },
	{ path: "/tools/tumai-days", heading: "TUM.ai Days RSVP" },
	{ path: "/contracts", heading: "Create Contract" },
] as const;

// The profile page (route "/") always renders the CV panel heading, so it is a
// stable "we landed back on the profile" signal after a guard redirect.
async function expectOnProfile(page: Page): Promise<void> {
	await page.waitForURL((url) => url.pathname === "/");
	await expect(
		page.getByRole("heading", { name: "CV", exact: true }),
	).toBeVisible();
}

test.describe("RBAC: admin-only routes", () => {
	test("a regular member is redirected home from every gated route", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		for (const route of GATED_ROUTES) {
			await page.goto(route.path);

			// The guard replaces the location with "/" and never mounts the gated
			// page, so its heading must not appear.
			await expectOnProfile(page);
			await expect(
				page.getByRole("heading", { name: route.heading }),
			).toHaveCount(0);
		}
	});

	test("an admin can open every gated route", async ({ page }) => {
		await loginAsLocalAdmin(page);

		for (const route of GATED_ROUTES) {
			await page.goto(route.path);
			await expect(
				page.getByRole("heading", { name: route.heading }),
			).toBeVisible();
			await expect(page).toHaveURL(new RegExp(`${route.path}$`));
		}
	});
});
