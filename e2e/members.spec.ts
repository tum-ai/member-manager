import { expect, type Page, test } from "@playwright/test";
import { loginAsLocalMember } from "./helpers";

// All assertions below are anchored to deterministic rows in supabase/seed.sql
// (the `seed_users_local` table). The members directory is a read-only browse
// surface, so every seeded member renders for any authenticated user.
//
// Seeded members of note (given_name surname — department — role — status):
//   Ada President        — Legal & Finance      — President   — active
//   Vera Vice            — Community            — Vice-President — active
//   Bianca Boardlead     — Software Development — Team Lead (Board Member) — active
//   Ben Boardmember      — Software Development — Member (Board Member)    — active
//   Clara Community      — Community            — Team Lead   — active
//   Regular Member       — (no department)     — Member      — active
//   Ines Innovation      — Innovation Department — Team Lead  — active
//   Lea Finance          — Legal & Finance      — Team Lead (Board Member) — active
//   Luca Finance         — Legal & Finance      — Member      — active
//   Maya Makeathon       — Makeathon            — Team Lead   — active
//   Max Makeathon        — Makeathon            — Member      — active
//   Mina Marketing       — Marketing            — Team Lead   — active
//   Sofia Software       — Software Development  — Team Lead   — active
//   Rita Research        — Research             — Member      — active
//   Robin Research       — Research             — Member      — alumni
//   Valerie Venture      — Venture              — Team Lead   — active
//   Victor Venture       — Venture              — Member      — inactive

// The directory renders each member's full name as bold card text. Waiting on a
// stable seeded name (rather than a fixed sleep) guarantees the members query
// resolved and the cards mounted before we assert counts/filters.
async function gotoMembers(page: Page): Promise<void> {
	await page.goto("/members");
	await expect(
		page.getByRole("heading", { name: "All Members" }),
	).toBeVisible();
	await expect(page.getByText("Ada President", { exact: true })).toBeVisible();
}

// The footer reads "{N} member profile(s)" and updates as filters narrow the
// set. Returning the live count lets each test assert relative narrowing without
// hard-coding the full seed size (which grows as seed.sql gains rows).
async function readProfileCount(page: Page): Promise<number> {
	const footer = page.getByText(/\d+ member profiles?/);
	await expect(footer).toBeVisible();
	const text = (await footer.textContent()) ?? "";
	const match = text.match(/(\d+) member profiles?/);
	if (!match) throw new Error(`Unexpected count footer: "${text}"`);
	return Number(match[1]);
}

// shadcn/radix Select: the trigger exposes its `aria-label` as the accessible
// name (role "combobox"); options render as role "option" once open.
async function selectFilter(
	page: Page,
	label: string,
	option: string,
): Promise<void> {
	await page.getByLabel(label, { exact: true }).click();
	await page.getByRole("option", { name: option, exact: true }).click();
}

test.describe("members directory", () => {
	test("renders the directory heading, description and seeded cards", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		await expect(
			page.getByText(
				"Browse the TUM.ai member and alumni network and search across profiles.",
			),
		).toBeVisible();

		// A spread of seeded members across departments and roles.
		for (const name of [
			"Ada President",
			"Sofia Software",
			"Maya Makeathon",
			"Valerie Venture",
			"Ines Innovation",
		]) {
			await expect(page.getByText(name, { exact: true })).toBeVisible();
		}

		// Seed ships well over a dozen members; the count footer must reflect that.
		const total = await readProfileCount(page);
		expect(total).toBeGreaterThanOrEqual(15);
	});

	test("search narrows by name and shows the empty state for no match", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		const search = page.getByPlaceholder("Search members...");

		// A surname shared by two seeded rows (Lea + Luca Finance) keeps both, but
		// drops unrelated members like Sofia Software.
		await search.fill("Finance");
		await expect(page.getByText("Lea Finance", { exact: true })).toBeVisible();
		await expect(page.getByText("Luca Finance", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeHidden();

		// An unmatched query renders the dedicated empty state copy.
		await search.fill("zzz-no-such-member-zzz");
		await expect(page.getByText("No members match your search.")).toBeVisible();
		expect(await readProfileCount(page)).toBe(0);

		// Clearing the box restores the full directory.
		await search.fill("");
		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeVisible();
	});

	test("department filter shows only that department's members", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		await selectFilter(page, "Department", "Makeathon");

		// Maya (lead) and Max (member) are the seeded Makeathon members.
		await expect(
			page.getByText("Maya Makeathon", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Max Makeathon", { exact: true }),
		).toBeVisible();
		// A member from another department must drop out.
		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeHidden();
		expect(await readProfileCount(page)).toBe(2);

		// Clearing back to "All" restores the directory.
		await selectFilter(page, "Department", "All");
		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeVisible();
	});

	test("role filter shows only members with the chosen role", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		const everyone = await readProfileCount(page);

		await selectFilter(page, "Role", "Team Lead");
		// Seeded team leads appear; a plain Member is filtered out.
		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Maya Makeathon", { exact: true }),
		).toBeVisible();
		await expect(page.getByText("Luca Finance", { exact: true })).toBeHidden();

		const leads = await readProfileCount(page);
		expect(leads).toBeGreaterThan(0);
		expect(leads).toBeLessThan(everyone);
	});

	test("status filter separates active members from alumni", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		// Robin Research is the only seeded `alumni` row.
		await selectFilter(page, "Status", "Alumni");
		await expect(
			page.getByText("Robin Research", { exact: true }),
		).toBeVisible();
		await expect(page.getByText("Ada President", { exact: true })).toBeHidden();

		// Switching to Active drops the alumnus and restores active members.
		await selectFilter(page, "Status", "Active");
		await expect(
			page.getByText("Ada President", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Robin Research", { exact: true }),
		).toBeHidden();
	});

	test("degree filter narrows to members holding that degree level", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		const everyone = await readProfileCount(page);

		// Ada President and Rita Research carry a PhD degree in the seed.
		await selectFilter(page, "Degree", "PhD");
		await expect(
			page.getByText("Ada President", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Rita Research", { exact: true }),
		).toBeVisible();
		// A Bachelor-only member must be excluded.
		await expect(page.getByText("Max Makeathon", { exact: true })).toBeHidden();

		const phds = await readProfileCount(page);
		expect(phds).toBeGreaterThan(0);
		expect(phds).toBeLessThan(everyone);
	});

	test("program filter narrows by the seeded study program", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		const everyone = await readProfileCount(page);

		// Program options are derived from the seeded degrees; "Computer Science"
		// covers Sofia/Max/etc. (M.Sc./B.Sc. Computer Science) but not the
		// Management & Technology cohort.
		await selectFilter(page, "Major / Program", "Computer Science");
		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Paula Partners", { exact: true }),
		).toBeHidden();

		const cs = await readProfileCount(page);
		expect(cs).toBeGreaterThan(0);
		expect(cs).toBeLessThan(everyone);
	});

	test("combined filters intersect, then clearing restores the directory", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await gotoMembers(page);

		// Software Development + Team Lead leaves only Sofia and Bianca (both
		// seeded SW-Dev leads); Ben (SW-Dev Member) is excluded by the role filter.
		await selectFilter(page, "Department", "Software Development");
		await selectFilter(page, "Role", "Team Lead");

		await expect(
			page.getByText("Sofia Software", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Bianca Boardlead", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Ben Boardmember", { exact: true }),
		).toBeHidden();
		expect(await readProfileCount(page)).toBe(2);

		// Reset both selects.
		await selectFilter(page, "Role", "All");
		await selectFilter(page, "Department", "All");
		await expect(
			page.getByText("Maya Makeathon", { exact: true }),
		).toBeVisible();
	});
});

test.describe("members org chart", () => {
	test("renders board sections and department members", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto("/members/org-chart");

		await expect(
			page.getByRole("heading", { name: "Org Chart" }),
		).toBeVisible();
		await expect(
			page.getByText("Overview of current leadership and departments."),
		).toBeVisible();

		// Board card with its sub-labels and the seeded occupants.
		await expect(page.getByText("Board", { exact: true })).toBeVisible();
		await expect(page.getByText("President", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Vice President", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Board Members", { exact: true }),
		).toBeVisible();
		// President -> Ada, Vice-President -> Vera. Ada President also appears under
		// her department (Legal & Finance), so match the first (the board card).
		await expect(
			page.getByText("Ada President", { exact: true }).first(),
		).toBeVisible();
		await expect(
			page.getByText("Vera Vice", { exact: true }).first(),
		).toBeVisible();

		// Departments section with the count badge (seed spans every department).
		await expect(page.getByText("Departments", { exact: true })).toBeVisible();
		await expect(page.getByText(/\d+ departments?/)).toBeVisible();

		// A known team lead and member surface under the right department card.
		await expect(page.getByText("Makeathon", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Maya Makeathon", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Max Makeathon", { exact: true }),
		).toBeVisible();
	});

	test("excludes alumni and inactive members from the chart", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/members/org-chart");
		await expect(
			page.getByRole("heading", { name: "Org Chart" }),
		).toBeVisible();

		// Robin Research is alumni and Victor Venture is inactive — both omitted.
		await expect(
			page.getByText("Robin Research", { exact: true }),
		).toBeHidden();
		await expect(
			page.getByText("Victor Venture", { exact: true }),
		).toBeHidden();
		// The active Venture lead still renders.
		await expect(
			page.getByText("Valerie Venture", { exact: true }),
		).toBeVisible();
	});
});

test.describe("members org tree", () => {
	test("renders the interactive diagram with board and department nodes", async ({
		page,
	}) => {
		await loginAsLocalMember(page);
		await page.goto("/members/org-tree");

		await expect(page.getByRole("heading", { name: "Org Tree" })).toBeVisible();
		await expect(
			page.getByText(
				"Interactive hierarchy of the board, departments, and their co-leads. Click a department to reveal its members.",
			),
		).toBeVisible();

		// d3-org-chart renders node cards as HTML inside the SVG. The board card and
		// every department node are expanded by default (only member leaves start
		// collapsed), so their labels are queryable immediately.
		await expect(
			page.getByText("Executive Board", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Ada President", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Software Development", { exact: true }),
		).toBeVisible();

		// The diagram exposes pan/zoom controls as labelled icon buttons.
		await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Fit to screen" }),
		).toBeVisible();
	});

	test("expanding the tree reveals department members", async ({ page }) => {
		await loginAsLocalMember(page);
		await page.goto("/members/org-tree");
		await expect(page.getByRole("heading", { name: "Org Tree" })).toBeVisible();
		await expect(
			page.getByText("Software Development", { exact: true }),
		).toBeVisible();

		// Member leaves (e.g. Max Makeathon, a non-lead Makeathon member) are
		// collapsed under their department until expanded. "Expand all" opens every
		// node, surfacing the member person-cards.
		await expect(page.getByText("Max Makeathon", { exact: true })).toBeHidden();

		await page.getByRole("button", { name: "Expand all" }).click();

		await expect(
			page.getByText("Max Makeathon", { exact: true }),
		).toBeVisible();
	});
});

test.describe("members navigation", () => {
	test("the sidebar Members group links route to each view", async ({
		page,
	}) => {
		await loginAsLocalMember(page);

		// Starting on /members opens the collapsible "Members" group by default, so
		// its sub-links are mounted in the sidebar.
		await gotoMembers(page);

		await page.getByRole("link", { name: "Org Chart" }).click();
		await expect(page).toHaveURL(/\/members\/org-chart$/);
		await expect(
			page.getByRole("heading", { name: "Org Chart" }),
		).toBeVisible();

		await page.getByRole("link", { name: "Org Tree" }).click();
		await expect(page).toHaveURL(/\/members\/org-tree$/);
		await expect(page.getByRole("heading", { name: "Org Tree" })).toBeVisible();

		await page.getByRole("link", { name: "Browse" }).click();
		await expect(page).toHaveURL(/\/members$/);
		await expect(
			page.getByRole("heading", { name: "All Members" }),
		).toBeVisible();
	});
});
