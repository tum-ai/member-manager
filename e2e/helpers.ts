import { expect, type Page } from "@playwright/test";

// The login screen exposes "Continue as local admin" only when the client runs
// in dev mode against a local Supabase project (see client Auth.tsx). The button
// signs in with the seeded admin account (admin@example.com / password123).
export async function loginAsLocalAdmin(page: Page): Promise<void> {
	await page.goto("/");
	await page.getByRole("button", { name: /continue as local admin/i }).click();
	// The authenticated shell renders the persistent "Tools" sidebar section
	// label (shadcn sidebar group label).
	await expect(page.getByText("Tools", { exact: true })).toBeVisible();
}
