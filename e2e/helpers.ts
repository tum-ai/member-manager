import { expect, type Page } from "@playwright/test";

// The login screen exposes "Continue as local admin" only when the client runs
// in dev mode against a local Supabase project (see client Auth.tsx). The button
// signs in with the seeded admin account (admin@example.com / password123).
export async function loginAsLocalAdmin(page: Page): Promise<void> {
	await page.goto("/");
	await page.getByRole("button", { name: /continue as local admin/i }).click();
	// The authenticated shell renders the persistent "Tools" sidebar group as a
	// collapsible trigger button (shadcn sidebar).
	await expect(page.getByRole("button", { name: "Tools" })).toBeVisible();
}
