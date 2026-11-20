import { expect, type Page, test } from "@playwright/test";
import { expectToast, loginAsLocalMember } from "./helpers";

// Issue #397: members lost profile data when switching away and back. Two
// causes: a background refetch / re-emitted auth event overwrote the form with
// server data, and the form showed defaults (e.g. the current batch) that were
// never saved. These specs pin both down against the real stack.

// Client-side navigation (no reload), like clicking a sidebar link.
async function navigateInApp(page: Page, path: string): Promise<void> {
	await page.evaluate((to) => {
		window.history.pushState({}, "", to);
		window.dispatchEvent(new PopStateEvent("popstate"));
	}, path);
}

// What the browser fires when the tab is hidden and shown again.
async function switchTabAwayAndBack(page: Page): Promise<void> {
	await page.evaluate(() => {
		const setVisibility = (state: "hidden" | "visible") => {
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => state,
			});
			document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
		};
		setVisibility("hidden");
		setVisibility("visible");
	});
}

test("a saved batch is still there after leaving the profile and coming back", async ({
	page,
}) => {
	await loginAsLocalMember(page);
	const batch = page.getByRole("combobox", { name: "Batch" });
	await expect(batch).toBeVisible();

	// Pick a batch that differs from the current one so the save is a real change.
	const nextBatch = (await batch.textContent())?.includes("WS23")
		? "SS24"
		: "WS23";
	await batch.click();
	await page.getByRole("option", { name: nextBatch, exact: true }).click();

	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();
	await expectToast(page, /profile saved successfully/i);

	await navigateInApp(page, "/members");
	await expect(page).toHaveURL(/\/members$/);
	await navigateInApp(page, "/");

	await expect(page.getByRole("combobox", { name: "Batch" })).toContainText(
		nextBatch,
	);
});

test("typed but unsaved input survives the tab being hidden and shown again", async ({
	page,
}) => {
	await loginAsLocalMember(page);
	const location = page.getByLabel("Public location");
	await expect(location).toBeVisible();

	const typed = `Unsaved location ${Date.now()}`;
	await location.fill(typed);

	// A refocus refetches the profile and makes supabase-js re-emit SIGNED_IN.
	const refetched = page.waitForResponse(
		(response) =>
			response.url().includes("/api/profile/") &&
			response.request().method() === "GET",
	);
	await switchTabAwayAndBack(page);
	await refetched;

	await expect(location).toHaveValue(typed);
});

test("a save rejected as stale keeps the edits and offers to keep or discard them", async ({
	page,
}) => {
	const loaded = page.waitForResponse(
		(response) =>
			response.url().includes("/api/profile/") &&
			response.request().method() === "GET",
	);
	await loginAsLocalMember(page);
	const current = await (await loaded).json();

	await page.route("**/api/profile/*", async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		await route.fulfill({
			status: 412,
			contentType: "application/json",
			body: JSON.stringify({
				error: "Your profile was changed elsewhere.",
				code: "profile_version_conflict",
				current: { ...current, version: current.version + 1 },
			}),
		});
	});

	const location = page.getByLabel("Public location");
	const typed = `My edit ${Date.now()}`;
	await location.fill(typed);
	await page
		.getByRole("button", { name: /save changes/i })
		.first()
		.click();

	await expect(
		page.getByRole("alert").filter({ hasText: /changed elsewhere/i }),
	).toBeVisible();
	await expect(location).toHaveValue(typed);

	await page.getByRole("button", { name: /keep my changes/i }).click();
	await expect(page.getByRole("alert")).toHaveCount(0);
	await expect(location).toHaveValue(typed);
});
