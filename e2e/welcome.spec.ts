import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
	expectAuthenticated,
	expectToast,
	loginAsLocalMember,
	loginWithSeedEmail,
	SEED_NEW_JOINER_EMAIL,
} from "./helpers";

// The /welcome page collects per-purpose consent and the CV, and active
// members can't leave it until both are done. The seeded new-joiner
// (supabase/seed.sql, …0024) has no member_agreements row and no CV, so login
// sends them there.
//
// The first spec only reads that state; the second one completes it. Keep
// that order: once both are saved the redirect no longer happens until the
// next `pnpm supabase:reset`.
const CV_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

test("an unfinished member is kept on /welcome", async ({ page }) => {
	await loginWithSeedEmail(page, SEED_NEW_JOINER_EMAIL);

	await expect(page).toHaveURL(/\/welcome$/);
	await expect(
		page.getByRole("heading", { name: "Welcome to the Member Manager" }),
	).toBeVisible();
	// Nothing is pre-ticked for an undecided member.
	await expect(
		page.getByRole("checkbox", { name: /sharing my data/i }),
	).not.toBeChecked();

	// There is no skip: Continue waits for both steps.
	await expect(
		page.getByRole("button", { name: "Later", exact: true }),
	).toHaveCount(0);
	const proceed = page.getByRole("button", { name: "Continue", exact: true });
	await expect(proceed).toBeDisabled();
	await expect(proceed).toHaveAccessibleDescription(
		"To continue, save your consent choices and upload your CV.",
	);

	// Opening another page directly sends them straight back.
	await page.goto("/tools/jobs");
	await expect(page).toHaveURL(/\/welcome$/);
});

test("a member saves their consents and uploads a CV on /welcome", async ({
	page,
}) => {
	await loginWithSeedEmail(page, SEED_NEW_JOINER_EMAIL);
	await page.goto("/welcome");

	await page.getByRole("button", { name: "Agree to all" }).click();
	const saved = page.waitForResponse(
		(response) =>
			/\/api\/members\/[^/]+\/consents$/.test(response.url()) &&
			response.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Save my choices" }).click();
	expect((await saved).status()).toBe(200);
	await expectToast(page, "Your consent choices are saved.");
	await expect(
		page.getByRole("button", { name: "Choices saved" }),
	).toBeDisabled();
	// Deciding alone isn't enough for an active member.
	const proceed = page.getByRole("button", { name: "Continue", exact: true });
	await expect(proceed).toHaveAccessibleDescription(
		"To continue, upload your CV.",
	);

	const uploaded = page.waitForResponse(
		(response) =>
			/\/api\/members\/[^/]+\/cv$/.test(response.url()) &&
			response.request().method() === "POST",
	);
	await page
		.locator("#cv")
		.locator('input[type="file"]')
		.setInputFiles(CV_FIXTURE);
	expect((await uploaded).status()).toBe(201);

	await expect(proceed).toBeEnabled();
	await proceed.click();
	await expect(page).toHaveURL(/\/$/);

	// Finished now: reloading isn't redirected any more.
	await page.reload();
	await expectAuthenticated(page);
	await expect(page).toHaveURL(/\/$/);
});

test("a /welcome link opened before login survives the login", async ({
	page,
}) => {
	// Logged out: the app shows the login screen and remembers the path.
	await page.goto("/welcome");
	// The path is remembered once the login screen has rendered, like for a
	// real visitor who lands on it before signing in.
	await expect(
		page.getByRole("button", { name: /continue as regular user/i }),
	).toBeVisible();
	await loginAsLocalMember(page);

	await expect(page).toHaveURL(/\/welcome$/);
	await expect(
		page.getByRole("heading", { name: "Welcome to the Member Manager" }),
	).toBeVisible();
});
