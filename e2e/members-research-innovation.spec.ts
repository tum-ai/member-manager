import { expect, test } from "@playwright/test";
import { loginAsLocalMember } from "./helpers";

// /members/research and /members/innovation are open to any authenticated user
// (no admin gate in App.tsx).
//
// Innovation "Task Forces" are a DETERMINISTIC, hard-coded list served by the
// server route (server/src/routes/researchProjects.ts -> innovationProjects),
// so we assert one by name. Research projects, by contrast, are fetched live
// from the TUM.ai website API (WEBSITE_RESEARCH_API_URL, default
// https://www.tum-ai.com/api/getResearch) — they are NOT seeded locally — so
// the research assertions only cover what the route guarantees regardless of
// that upstream: the page heading and a non-error render.

test.describe("members research + innovation", () => {
	test("innovation page renders the seeded task forces", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto("/members/innovation");

		await expect(
			page.getByRole("heading", { name: "Task Forces" }),
		).toBeVisible();

		// "Women@TUM.ai" is part of the hard-coded innovation list, so it must
		// always render (not the empty state).
		await expect(page.getByText("Women@TUM.ai", { exact: true })).toBeVisible();
		await expect(page.getByText("med.AI", { exact: true })).toBeVisible();
	});

	test("research page renders its heading without erroring", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/members/research");

		await expect(
			page.getByRole("heading", { name: "Research", exact: true }),
		).toBeVisible();

		// The research project list depends on the live website API, which may be
		// unreachable in CI. Either the populated section or the empty state is a
		// valid, non-crashing render; the error branch ("Failed to load members")
		// must NOT appear.
		await expect(
			page.getByText("Failed to load members. Please try again later."),
		).toHaveCount(0);
	});
});
