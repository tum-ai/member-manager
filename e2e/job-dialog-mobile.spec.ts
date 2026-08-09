import { expect, test } from "@playwright/test";

test("keeps a long job editor scrollable within the mobile viewport", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("button", { name: /continue as local admin/i }).click();
	await expect(
		page.getByRole("button", { name: "Toggle Sidebar" }),
	).toBeVisible();
	await page.goto("/admin/job-requests");
	await page.getByRole("button", { name: "Create standalone job" }).click();

	const description = page.getByLabel("Description");
	await description.fill(
		"Build reliable production AI systems with the engineering team. ".repeat(
			80,
		),
	);

	const dialog = page.getByRole("dialog");
	const dialogBounds = await dialog.boundingBox();
	const viewport = page.viewportSize();
	expect(dialogBounds).not.toBeNull();
	expect(viewport).not.toBeNull();
	expect(dialogBounds?.y ?? -1).toBeGreaterThanOrEqual(0);
	expect(
		(dialogBounds?.y ?? 0) + (dialogBounds?.height ?? 0),
	).toBeLessThanOrEqual(viewport?.height ?? 0);

	const formBody = dialog.locator("form > div.overflow-y-auto");
	await expect
		.poll(async () =>
			formBody.evaluate(
				(element) => element.scrollHeight > element.clientHeight,
			),
		)
		.toBe(true);
	await expect
		.poll(async () =>
			description.evaluate(
				(element) => element.scrollHeight > element.clientHeight,
			),
		)
		.toBe(true);
	await expect(
		dialog.getByRole("button", { name: "Publish job" }),
	).toBeVisible();
});
