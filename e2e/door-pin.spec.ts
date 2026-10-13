import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
	expectToast,
	loginAsLocalAdmin,
	loginAsLocalMember,
	loginWithSeedEmail,
	SEED_NEW_JOINER_EMAIL,
	SEED_NO_BANK_DETAILS_MEMBER_EMAIL,
	SEED_REGULAR_MEMBER_DOOR_PIN,
} from "./helpers";

// Door PINs for the office key cabinet: members see theirs on the profile
// once /welcome is saved; admins import the cabinet's Traka21 user sheet.
//
// MUTATION NOTE: the import test changes seeded PINs (user@example.com,
// legal-finance-member@example.com), so it is one-shot per fresh database
// (`pnpm supabase:reset`). The read-only tests run first. The /welcome gate
// test needs the new joiner undecided, which e2e/welcome.spec.ts changes, so
// it too needs a fresh database.
//
// The fixture is a synthetic Traka21 sheet (seed emails, fake PINs): a
// cabinet admin row, admin@example.com with its seeded PIN (unchanged),
// USER@example.com with a new PIN (updated), legal-finance-member@example.com
// (created) and not-a-member@example.com (no account).
const TRAKA_FIXTURE = fileURLToPath(
	new URL("./fixtures/door-pins-traka.xlsx", import.meta.url),
);

test("a member reveals their door PIN on the profile", async ({ page }) => {
	await loginAsLocalMember(page);

	const card = page.locator("#door-pin");
	await expect(card.getByRole("heading", { name: "Door PIN" })).toBeVisible();
	await expect(card.getByText(SEED_REGULAR_MEMBER_DOOR_PIN)).toHaveCount(0);

	await card.getByRole("button", { name: "Show PIN" }).click();
	await expect(card.getByText(SEED_REGULAR_MEMBER_DOOR_PIN)).toBeVisible();

	await card.getByRole("button", { name: "Hide PIN" }).click();
	await expect(card.getByText(SEED_REGULAR_MEMBER_DOOR_PIN)).toHaveCount(0);
});

test("a member without a PIN is told so", async ({ page }) => {
	await loginWithSeedEmail(page, SEED_NO_BANK_DETAILS_MEMBER_EMAIL);

	await expect(
		page.locator("#door-pin").getByText(/You don't have a door PIN yet/),
	).toBeVisible();
});

test("the PIN waits until /welcome is saved", async ({ page }) => {
	await loginWithSeedEmail(page, SEED_NEW_JOINER_EMAIL);
	// Undecided members land on /welcome; postpone it to reach the profile.
	await expect(page).toHaveURL(/\/welcome$/);
	await page.getByRole("button", { name: "Later", exact: true }).click();
	await expect(page).toHaveURL(/\/$/);

	const card = page.locator("#door-pin");
	await expect(
		card.getByText("Finish your welcome steps to see your door PIN."),
	).toBeVisible();
	await expect(card.getByRole("button", { name: "Show PIN" })).toHaveCount(0);
	await card.getByRole("link", { name: "Go to welcome" }).click();
	await expect(page).toHaveURL(/\/welcome$/);
});

test("an admin imports the cabinet sheet and checks a member's PIN", async ({
	page,
}) => {
	// The member editor dialog is tall; keep its controls on screen.
	await page.setViewportSize({ width: 1280, height: 1800 });
	await loginAsLocalAdmin(page);
	await page.goto("/admin");

	await page.getByRole("button", { name: "Import door PINs" }).click();
	const dialog = page.getByRole("dialog", { name: "Import door PINs" });
	const dryRun = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/admin/door-pins/import") &&
			response.request().method() === "POST",
	);
	await dialog.getByLabel("Traka21 sheet").setInputFiles(TRAKA_FIXTURE);
	expect((await dryRun).status()).toBe(200);

	// The preview, before anything is saved.
	await dialog.getByText("No member account with this email (1)").click();
	await expect(dialog.getByText("not-a-member@example.com")).toBeVisible();
	await dialog.getByText("Skipped in the sheet (1)").click();
	await expect(dialog.getByText(/Cabinet admin account/)).toBeVisible();

	const applied = page.waitForResponse(
		(response) =>
			response.url().endsWith("/api/admin/door-pins/import") &&
			response.request().method() === "POST",
	);
	await dialog.getByRole("button", { name: "Apply 2 PINs" }).click();
	expect((await applied).status()).toBe(200);
	await expectToast(page, "Imported 2 door PINs.");
	await dialog.getByRole("button", { name: "Done" }).click();
	await expect(dialog).toHaveCount(0);

	// The editor shows the imported PIN only on request.
	await page
		.getByRole("button", { name: "Edit member Regular User", exact: true })
		.click();
	const editor = page.getByRole("dialog", { name: "Edit member" });
	await expect(editor.getByText("555001")).toHaveCount(0);
	await editor.getByRole("button", { name: "Show current PIN" }).click();
	await expect(editor.getByText("555001")).toBeVisible();
});
