import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
	expectAuthenticated,
	expectToast,
	loginAsLocalMember,
	loginWithSeedEmail,
	SEED_NEW_JOINER_EMAIL,
} from "./helpers";

// The /welcome page collects per-purpose consent and the CV. The seeded
// new-joiner (supabase/seed.sql, …0024) has no member_agreements row, so their
// consents are undecided and login redirects them there.
//
// The first spec only reads that state; the second one saves a decision. Keep
// that order: once a decision is saved the redirect no longer happens until
// the next `pnpm supabase:reset`.
const CV_FIXTURE = fileURLToPath(
	new URL("./fixtures/receipt.pdf", import.meta.url),
);

test("an undecided member is sent to /welcome and can postpone it", async ({
	page,
}) => {
	await loginWithSeedEmail(page, SEED_NEW_JOINER_EMAIL);

	await expect(page).toHaveURL(/\/welcome$/);
	await expect(
		page.getByRole("heading", { name: "Welcome to the Member Manager" }),
	).toBeVisible();
	// Nothing is pre-ticked for an undecided member.
	await expect(
		page.getByRole("checkbox", { name: /sharing my data/i }),
	).not.toBeChecked();

	await page.getByRole("button", { name: "Later", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);

	// "Later" holds for the rest of the browser session.
	await page.reload();
	await expectAuthenticated(page);
	await expect(page).toHaveURL(/\/$/);
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

	await page.getByRole("button", { name: "Continue to your profile" }).click();
	await expect(page).toHaveURL(/\/$/);

	// Decided now: a fresh session isn't redirected any more.
	await page.evaluate(() => window.sessionStorage.clear());
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
