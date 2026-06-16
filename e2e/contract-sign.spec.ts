import { expect, test } from "@playwright/test";
import { SEED_CONTRACT_SIGN_TOKEN } from "./helpers";

// Exercises the public partner-signing flow (/contracts/sign/:token). The route
// renders before the auth gate, so no login is required. A seeded contract
// submission in `sent_to_partner` state exposes a long-lived signing token (see
// supabase/seed.sql), so the document loads and accepts a signature.
//
// NOTE: signing mutates the seeded row (sets signed_at), so this test is
// stateful and one-shot per database. CI gets a fresh Supabase stack each run;
// for repeated local runs, reset the DB (`supabase db reset`) between runs.
//
// Retries are disabled for this spec: a retry would re-run against the now-signed
// token and fail misleadingly (the page renders the already-signed state, not the
// sign form). global-setup fails fast if the token was already consumed, so a
// non-fresh DB is caught before the suite rather than masked by retries.
test.describe.configure({ retries: 0 });

test("a partner can sign a contract via the public signing link", async ({
	page,
}) => {
	await page.goto(`/contracts/sign/${SEED_CONTRACT_SIGN_TOKEN}`);

	await expect(
		page.getByRole("heading", { name: "Sign contract" }),
	).toBeVisible();

	// The seeded document text references the partner company; assert it rendered
	// so we know the payload loaded (not an error/expired/already-signed state).
	await expect(page.getByText(/Soylent Corp/i).first()).toBeVisible();

	await page.getByLabel("Full name").fill("Bob Soylent");

	// The signature pad is a <canvas> that only emits a data URL after a pointer
	// stroke; drag across it to produce a non-empty signature, which enables the
	// Sign button.
	const canvas = page.locator("canvas");
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	if (!box) throw new Error("signature canvas has no bounding box");
	await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
	await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6);
	await page.mouse.up();

	const signButton = page.getByRole("button", { name: "Sign", exact: true });
	await expect(signButton).toBeEnabled();
	await signButton.click();

	await expect(page.getByText(/the contract has been signed/i)).toBeVisible();
});
