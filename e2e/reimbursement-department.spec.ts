import { expect, test } from "@playwright/test";
import {
	loginWithSeedEmail,
	SEED_LEGAL_FINANCE_MEMBER_EMAIL,
	SEED_MAKEATHON_MEMBER_EMAIL,
} from "./helpers";

// Seeded by supabase/seed.sql: the Makeathon lead's invoice for Makeathon.
const MAKEATHON_REQUEST = "Makeathon prototype materials";
const MAKEATHON_RECEIPT = "prototype-materials.pdf";

// #367: members see what the rest of their department already submitted, so an
// invoice isn't handed in twice. They get a summary only.
test("a member sees a colleague's request for their department as a summary", async ({
	page,
}) => {
	await loginWithSeedEmail(page, SEED_MAKEATHON_MEMBER_EMAIL);

	const listResponse = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === "/api/reimbursements/department",
	);
	await page.goto("/tools/reimbursement");

	await expect(
		page.getByRole("heading", { name: "Makeathon requests" }),
	).toBeVisible();
	const row = page.getByRole("listitem").filter({ hasText: MAKEATHON_REQUEST });
	await expect(row).toContainText("Maya Makeathon");
	await expect(row).toContainText("Invoice");
	await expect(page.getByText(MAKEATHON_RECEIPT)).toHaveCount(0);

	// The receipt and the payee's bank details never reach the colleague's
	// browser, not even unrendered.
	const body = (await (await listResponse).json()) as {
		department: string;
		requests: Array<Record<string, unknown>>;
	};
	expect(body.department).toBe("Makeathon");
	const request = body.requests.find(
		(entry) => entry.description === MAKEATHON_REQUEST,
	);
	expect(request).toMatchObject({
		requester_name: "Maya Makeathon",
		is_own: false,
	});
	const keys = Object.keys(request ?? {});
	expect(keys.filter((key) => /iban|bic|receipt|user_id/.test(key))).toEqual(
		[],
	);
});

test("a member of another department does not see that request", async ({
	page,
}) => {
	await loginWithSeedEmail(page, SEED_LEGAL_FINANCE_MEMBER_EMAIL);
	await page.goto("/tools/reimbursement");

	// Seeded: the Legal & Finance lead's own request for Legal & Finance.
	const row = page
		.getByRole("listitem")
		.filter({ hasText: "Finance workshop catering" });
	await expect(row).toContainText("Lea Finance");
	await expect(
		page.getByRole("heading", { name: "Legal & Finance requests" }),
	).toBeVisible();
	await expect(page.getByText(MAKEATHON_REQUEST)).toHaveCount(0);
});
