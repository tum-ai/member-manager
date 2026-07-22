import { expect, type Page } from "@playwright/test";

// Seeded local accounts (see supabase/seed.sql). All local seed users share the
// password `password123`.
export const SEED_ADMIN_EMAIL = "admin@example.com";
export const SEED_REGULAR_MEMBER_EMAIL = "regular-member@example.com";
export const SEED_LEGAL_FINANCE_MEMBER_EMAIL =
	"legal-finance-member@example.com";
export const SEED_MAKEATHON_LEAD_EMAIL = "makeathon-lead@example.com";

// A seeded contract submission in `sent_to_partner` state exposes this signing
// token with a far-future expiry and no `signed_at`, so the public signing page
// (/contracts/sign/:token) renders the document and accepts a signature.
export const SEED_CONTRACT_SIGN_TOKEN = "seed-signature-token-soylent-0004";

// The login screen exposes "Continue as local admin" / "Continue as regular
// user" only when the client runs in dev mode against a local Supabase project
// (see client Auth.tsx). They sign in with the seeded accounts above.
export async function loginAsLocalAdmin(page: Page): Promise<void> {
	await page.goto("/");
	await page.getByRole("button", { name: /continue as local admin/i }).click();
	await expectAuthenticated(page);
}

export async function loginAsLocalMember(page: Page): Promise<void> {
	await page.goto("/");
	await page.getByRole("button", { name: /continue as regular user/i }).click();
	await expectAuthenticated(page);
}

export async function loginWithSeedEmail(
	page: Page,
	email: string,
): Promise<void> {
	await page.goto("/");
	await page.evaluate(async (seedEmail) => {
		const { supabase } = await import("/src/lib/supabaseClient.ts");
		const { error } = await supabase.auth.signInWithPassword({
			email: seedEmail,
			password: "password123",
		});
		if (error) {
			throw new Error(error.message);
		}
	}, email);
	await page.reload();
	await expectAuthenticated(page);
}

// The authenticated shell renders the persistent "Tools" sidebar section label
// (shadcn sidebar group label). Its presence is a stable signal that auth
// completed and the app shell mounted.
export async function expectAuthenticated(page: Page): Promise<void> {
	await expect(page.getByText("Tools", { exact: true })).toBeVisible();
}

// Sonner toasts render their message as plain text; assert on the message we
// raise from the relevant feature (see ToastContext / feature pages).
export async function expectToast(
	page: Page,
	message: string | RegExp,
): Promise<void> {
	await expect(page.getByText(message).first()).toBeVisible();
}
