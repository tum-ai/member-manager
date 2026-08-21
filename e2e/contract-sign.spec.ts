import { expect, test } from "@playwright/test";
import { SEED_RETIRED_CONTRACT_SIGN_TOKEN } from "./helpers";

// The DOCX-only cutover keeps old text records readable but does not allow
// their public signing links to use the retired renderer.
test("rejects a historical text contract signing link", async ({ request }) => {
	const response = await request.get(
		`/api/contracts/sign/${SEED_RETIRED_CONTRACT_SIGN_TOKEN}`,
	);

	expect(response.status()).toBe(410);
	await expect(response.json()).resolves.toEqual({
		error: "This historical contract uses a retired document engine",
	});
});
