import { type APIRequestContext, expect, test } from "@playwright/test";
import {
	expectToast,
	loginAsLocalAdmin,
	loginAsLocalMember,
	readEnvFileValue,
} from "./helpers";

// An admin decides a member's nomcp (TUM.ai Notion MCP) access request, and
// the member sees the outcome on /connected-apps. In production the request
// comes from mcp_principal() when the member first connects an AI app; the
// seeded users have no TUM.ai Slack identity, so the spec files it directly.

const SUPABASE_URL = readEnvFileValue("server/.env.local", "SUPABASE_URL");
const SERVICE_ROLE_KEY = readEnvFileValue(
	"server/.env.local",
	"SUPABASE_SERVICE_ROLE_KEY",
);
// regular-member@example.com (loginAsLocalMember).
const MEMBER_ID = "00000000-0000-0000-0000-000000000006";
const MEMBER_NAME = "Regular Member";

async function setAccess(
	request: APIRequestContext,
	row: Record<string, unknown> | null,
): Promise<void> {
	const headers = {
		apikey: SERVICE_ROLE_KEY ?? "",
		authorization: `Bearer ${SERVICE_ROLE_KEY ?? ""}`,
	};
	const deleted = await request.delete(
		`${SUPABASE_URL}/rest/v1/mcp_access?user_id=eq.${MEMBER_ID}`,
		{ headers },
	);
	expect(deleted.ok()).toBe(true);
	if (row) {
		const inserted = await request.post(`${SUPABASE_URL}/rest/v1/mcp_access`, {
			headers,
			data: { user_id: MEMBER_ID, ...row },
		});
		expect(inserted.ok()).toBe(true);
	}
}

test.describe("nomcp access approval", () => {
	test.skip(
		!SUPABASE_URL || !SERVICE_ROLE_KEY,
		"server/.env.local is missing; run pnpm setup:local",
	);

	test.afterEach(async ({ request }) => {
		await setAccess(request, null);
	});

	test("an admin approves a pending request, then revokes it", async ({
		page,
		request,
	}) => {
		await setAccess(request, { status: "pending" });
		await loginAsLocalAdmin(page);
		await page.goto("/admin/mcp-access");

		const pending = page.getByRole("region", { name: "Waiting for approval" });
		await expect(pending.getByText(MEMBER_NAME, { exact: true })).toBeVisible();
		await pending.getByRole("radio", { name: "Reader" }).click();
		await pending
			.getByRole("button", { name: `Approve ${MEMBER_NAME} as reader` })
			.click();
		await expectToast(
			page,
			`${MEMBER_NAME} can now use the Notion MCP as reader.`,
		);

		const approved = page.getByRole("region", { name: "Approved" });
		await expect(
			approved.getByText(MEMBER_NAME, { exact: true }),
		).toBeVisible();
		await approved
			.getByRole("button", {
				name: `Revoke Notion MCP access for ${MEMBER_NAME}`,
			})
			.click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Note for admins (optional)").fill("E2E revoke");
		await dialog.getByRole("button", { name: "Revoke", exact: true }).click();
		await expectToast(page, `${MEMBER_NAME} no longer has Notion MCP access.`);

		const declined = page.getByRole("region", { name: "Declined" });
		await expect(
			declined.getByText(MEMBER_NAME, { exact: true }),
		).toBeVisible();
		await expect(declined.getByText("Note: E2E revoke")).toBeVisible();
	});

	test("a member sees their status on Connected apps", async ({
		page,
		request,
	}) => {
		await setAccess(request, { status: "approved", role: "editor" });
		await loginAsLocalMember(page);
		await page.goto("/connected-apps");

		await expect(page.getByTestId("notion-mcp-access-status")).toContainText(
			"Notion MCP access: approved as editor",
		);
	});
});
