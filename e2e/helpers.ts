import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

// Seeded local accounts (see supabase/seed.sql). All local seed users share the
// password `password123`.
export const SEED_ADMIN_EMAIL = "admin@example.com";
export const SEED_REGULAR_MEMBER_EMAIL = "regular-member@example.com";
export const SEED_LEGAL_FINANCE_MEMBER_EMAIL =
	"legal-finance-member@example.com";

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
	const { session, storageKey } = await getSeedSession(email);
	await page.evaluate(
		({ key, value }) => {
			window.localStorage.setItem(key, JSON.stringify(value));
		},
		{ key: storageKey, value: session },
	);
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

function readEnvFileValue(
	relativePath: string,
	key: string,
): string | undefined {
	let contents: string;
	try {
		contents = readFileSync(resolve(process.cwd(), relativePath), "utf8");
	} catch {
		return undefined;
	}

	for (const rawLine of contents.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq === -1 || line.slice(0, eq).trim() !== key) continue;
		let value = line.slice(eq + 1).trim();
		const quoted =
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"));
		if (quoted) value = value.slice(1, -1);
		return value;
	}

	return undefined;
}

function getLocalSupabaseConfig(): {
	supabaseUrl: string;
	supabaseAnonKey: string;
} {
	const supabaseUrl =
		process.env.VITE_SUPABASE_URL ??
		readEnvFileValue("client/.env.local", "VITE_SUPABASE_URL");
	const supabaseAnonKey =
		process.env.VITE_SUPABASE_ANON_KEY ??
		readEnvFileValue("client/.env.local", "VITE_SUPABASE_ANON_KEY");

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error(
			"E2E seeded email login requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Run `pnpm setup:local`.",
		);
	}

	return { supabaseUrl, supabaseAnonKey };
}

async function getSeedSession(email: string): Promise<{
	session: Record<string, unknown>;
	storageKey: string;
}> {
	const { supabaseUrl, supabaseAnonKey } = getLocalSupabaseConfig();
	const response = await fetch(
		`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
		{
			method: "POST",
			headers: {
				apikey: supabaseAnonKey,
				"content-type": "application/json",
			},
			body: JSON.stringify({ email, password: "password123" }),
		},
	);

	if (!response.ok) {
		throw new Error(
			`E2E seeded email login failed for ${email}: ${response.status} ${await response.text()}`,
		);
	}

	const session = (await response.json()) as Record<string, unknown>;
	const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
	return { session, storageKey };
}
