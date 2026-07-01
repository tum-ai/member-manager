import { expect, test } from "@playwright/test";
import { loginAsLocalMember } from "./helpers";

// /members/graph is open to any authenticated user (no admin gate in App.tsx).
// The graph is built client-side from /api/members; the Q&A hits
// /api/members/expertise-query, which falls back to deterministic keyword
// ranking when OPENAI_API_KEY is unset (the default local + CI state). The seed
// enriches Rita Research (active) and Robin Research (alumni) with the
// "machine-learning" tag, so the fallback deterministically ranks them.

test.describe("member expertise graph", () => {
	test("renders the graph and toggles a link reason", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto("/members/graph");

		await expect(
			page.getByRole("heading", { name: "Expertise Graph" }),
		).toBeVisible();
		await expect(
			page.getByRole("img", { name: /member expertise graph/i }),
		).toBeVisible();

		// "Expertise" is opt-in (off by default); toggling it on flips its state.
		const expertiseToggle = page.getByRole("button", { name: "Expertise" });
		await expect(expertiseToggle).toBeVisible();
		await expertiseToggle.click();
		await expect(expertiseToggle).toHaveAttribute("data-state", "on");
	});

	test("answers an expertise question and ranks matching members", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/members/graph");

		await page
			.getByRole("textbox", { name: /ask about member expertise/i })
			.fill("Who knows machine learning?");
		await page.getByRole("button", { name: "Ask", exact: true }).click();

		// The keyword fallback ranks the two seeded ML researchers; Rita sorts
		// first on the name tiebreak.
		await expect(page.getByText("Rita Research").first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
	});
});
