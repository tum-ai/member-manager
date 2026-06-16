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

	// The signature pad is a <canvas> that listens to pointer events and only
	// emits a data URL (enabling Sign) after a pointerdown→move→up stroke.
	// Dispatch the pointer events directly with explicit client coordinates:
	// synthesized mouse input does not reliably register the stroke headlessly.
	const canvas = page.locator("canvas");
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	if (!box) throw new Error("signature canvas has no bounding box");
	const at = (fx: number, fy: number) => ({
		pointerId: 1,
		isPrimary: true,
		bubbles: true,
		clientX: box.x + box.width * fx,
		clientY: box.y + box.height * fy,
	});
	await canvas.dispatchEvent("pointerdown", { button: 0, ...at(0.2, 0.5) });
	await canvas.dispatchEvent("pointermove", at(0.5, 0.3));
	await canvas.dispatchEvent("pointermove", at(0.8, 0.6));
	await canvas.dispatchEvent("pointerup", { button: 0, ...at(0.8, 0.6) });

	const signButton = page.getByRole("button", { name: "Sign", exact: true });
	await expect(signButton).toBeEnabled();
	await signButton.click();

	await expect(page.getByText(/the contract has been signed/i)).toBeVisible();
});
