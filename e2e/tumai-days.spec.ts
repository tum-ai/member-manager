import { expect, test } from "@playwright/test";
import { expectAuthenticated, expectToast, loginAsLocalAdmin } from "./helpers";

// TUM.ai Days RSVP management (route /tools/tumai-days, permission
// `tumai_days.manage`). The seeded admin (Ada President, user_roles.role =
// "admin") is a superuser via checkAdminRole, so checkTumaiDaysManager resolves
// true and the whole tool is reachable — see server/src/lib/auth.ts.
//
// The seed (supabase/seed.sql) provisions two events and a spread of RSVPs:
//   - 60000000-…-0001  "Upcoming TUM.ai Day"  scheduled now()+9d, not yet sent
//   - 60000000-…-0002  "Past TUM.ai Day"      scheduled now()-21d, already sent
// Past-event responses we assert on: Ada President (Legal & Finance) → yes,
// Regular User (Software Development) → no, reason "Exam period."
//
// NOTE on "submit a response": there is no member-facing RSVP submission flow
// and NO write endpoint for responses. The server (server/src/routes/tumaiDays.ts)
// only exposes GET /tum-ai-days/:id/responses (read-only audit, gated by
// requireTumaiDaysManager); RSVPs are written out-of-band by the Slack
// integration, not the HTTP API. So "submit a response" cannot be driven from
// the browser/API here. We instead exercise the read+audit surface end-to-end:
// the seeded RSVPs render, the stats aggregate, and search/status filtering work.

const TUMAI_DAYS_ROUTE = "/tools/tumai-days";
const PAST_EVENT_AGENDA = "Past TUM.ai Day";
const UPCOMING_EVENT_AGENDA = "Upcoming TUM.ai Day";

test.describe("TUM.ai Days RSVP — manage tool", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsLocalAdmin(page);
		await page.goto(TUMAI_DAYS_ROUTE);
		await expect(
			page.getByRole("heading", { name: "TUM.ai Days RSVP" }),
		).toBeVisible();
	});

	test("schedules a new event and it appears in the list", async ({ page }) => {
		const agenda = `E2E scheduled agenda ${Date.now()}`;

		await expect(
			page.getByRole("heading", { name: "Schedule Event" }),
		).toBeVisible();

		await page.locator("#event-agenda").fill(agenda);
		// datetime-local wants `YYYY-MM-DDTHH:MM`; pick a far-future slot so the
		// new event sorts/renders as upcoming and never collides with seeds.
		await page.locator("#event-scheduled-at").fill("2030-09-15T18:00");

		// Wait on the create POST so the assertion races the network, not a timer.
		const createResponse = page.waitForResponse(
			(r) =>
				r.url().includes("/api/tum-ai-days") &&
				!r.url().includes("/responses") &&
				!r.url().includes("/send-pending") &&
				r.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Schedule Event" }).click();
		const created = await createResponse;
		expect(created.status()).toBe(201);

		await expectToast(page, "TUM.ai Day scheduled successfully!");

		// The new event renders in the "Scheduled Events" list (agenda verbatim).
		await expect(
			page.getByRole("heading", { name: "Scheduled Events" }),
		).toBeVisible();
		// The agenda renders in the list AND (because creating auto-selects the
		// event) in the audit-panel header, so scope to the first occurrence.
		await expect(page.getByText(agenda).first()).toBeVisible();

		// Creating selects the new event (hook sets selectedEventId), so the audit
		// panel switches away from the empty state to the Audit Log for it.
		await expect(
			page.getByRole("heading", { name: "Audit Log" }),
		).toBeVisible();
	});

	test("shows the empty audit state until an event is selected", async ({
		page,
	}) => {
		await expect(
			page.getByRole("heading", { name: "No event selected" }),
		).toBeVisible();
		await expect(page.getByText(/Pick an event from the list/i)).toBeVisible();
	});

	test("opens the audit panel for the seeded past event with its RSVPs and stats", async ({
		page,
	}) => {
		// Select the seeded past event (rendered agenda is the full multi-line
		// string; match on its leading line).
		await page.getByText(PAST_EVENT_AGENDA).click();

		// Wait for the responses fetch so the panel is populated before asserting.
		await page.waitForResponse(
			(r) =>
				/\/api\/tum-ai-days\/[^/]+\/responses/.test(r.url()) &&
				r.request().method() === "GET",
		);

		await expect(
			page.getByRole("heading", { name: "Audit Log" }),
		).toBeVisible();

		// Stats grid labels + the response-rate label all render. "Pending" also
		// appears as a per-row status badge, so match the first (the stat label).
		for (const label of ["Total", "Attending", "Declined", "Pending"]) {
			await expect(
				page.getByText(label, { exact: true }).first(),
			).toBeVisible();
		}
		await expect(page.getByText(/Response rate ·/)).toBeVisible();

		// Seeded RSVPs surface in the audit TABLE: a yes (Ada President) and a no
		// with a reason (Regular User → "Exam period."). Scope to the table — the
		// signed-in admin is also "Ada President" (shown in the sidebar).
		const auditTable = page.getByRole("table");
		await expect(auditTable.getByText("Ada President")).toBeVisible();
		await expect(auditTable.getByText("Regular User")).toBeVisible();
		await expect(auditTable.getByText("Exam period.")).toBeVisible();
	});

	test("filters the audit table by search text and status", async ({
		page,
	}) => {
		await page.getByText(PAST_EVENT_AGENDA).click();
		await page.waitForResponse(
			(r) =>
				/\/api\/tum-ai-days\/[^/]+\/responses/.test(r.url()) &&
				r.request().method() === "GET",
		);
		await expect(
			page.getByRole("heading", { name: "Audit Log" }),
		).toBeVisible();

		// Scope member-name assertions to the audit table: the signed-in admin is
		// "Ada President", whose name also renders in the sidebar user button.
		const auditTable = page.getByRole("table");

		// --- Free-text search narrows the table ------------------------------
		// "Regular User" (user 20, the seeded "no") matches; "Ada President"
		// (the seeded "yes") drops out.
		await page.locator("#rsvp-search").fill("Regular User");
		await expect(auditTable.getByText("Regular User")).toBeVisible();
		await expect(auditTable.getByText("Ada President")).toHaveCount(0);

		// A search with no matches shows the empty-state copy.
		await page.locator("#rsvp-search").fill("zzz-no-such-member");
		await expect(page.getByText("No matches found.")).toBeVisible();

		await page.locator("#rsvp-search").clear();
		await expect(auditTable.getByText("Ada President")).toBeVisible();

		// --- Status filter (shadcn Select) ----------------------------------
		// Declined → only the "no" RSVP (Regular User) remains.
		await page.getByRole("combobox", { name: "Response Status" }).click();
		await page.getByRole("option", { name: "Declined (No)" }).click();
		await expect(auditTable.getByText("Regular User")).toBeVisible();
		await expect(auditTable.getByText("Ada President")).toHaveCount(0);

		// Attending → only the "yes" RSVP (Ada President) remains.
		await page.getByRole("combobox", { name: "Response Status" }).click();
		await page.getByRole("option", { name: "Attending (Yes)" }).click();
		await expect(auditTable.getByText("Ada President")).toBeVisible();
		await expect(auditTable.getByText("Regular User")).toHaveCount(0);

		// Pending → the audit lists every ACTIVE member defaulted to "pending"
		// (server-side: all active members minus those who responded). The two
		// past-event responders (Ada President = yes, Regular User = no) are
		// therefore excluded, while other active members (e.g. Regular Member,
		// user 6, who has no response to the past event) remain.
		await page.getByRole("combobox", { name: "Response Status" }).click();
		await page.getByRole("option", { name: "Pending" }).click();
		await expect(page.getByText("No matches found.")).toHaveCount(0);
		await expect(auditTable.getByText("Ada President")).toHaveCount(0);
		await expect(auditTable.getByText("Regular User")).toHaveCount(0);
		await expect(auditTable.getByText("Regular Member")).toBeVisible();

		// Back to All shows every seeded responder again.
		await page.getByRole("combobox", { name: "Response Status" }).click();
		await page.getByRole("option", { name: "All responses" }).click();
		await expect(auditTable.getByText("Ada President")).toBeVisible();
		await expect(auditTable.getByText("Regular User")).toBeVisible();
	});

	test("edits and then deletes an event created in-test", async ({ page }) => {
		const originalAgenda = `E2E edit-delete agenda ${Date.now()}`;
		const updatedAgenda = `${originalAgenda} (updated)`;

		// --- Create -----------------------------------------------------------
		await page.locator("#event-agenda").fill(originalAgenda);
		await page.locator("#event-scheduled-at").fill("2031-03-01T17:30");
		const createResponse = page.waitForResponse(
			(r) =>
				r.url().includes("/api/tum-ai-days") &&
				!r.url().includes("/responses") &&
				!r.url().includes("/send-pending") &&
				r.request().method() === "POST",
		);
		await page.getByRole("button", { name: "Schedule Event" }).click();
		await createResponse;
		await expectToast(page, "TUM.ai Day scheduled successfully!");
		await expect(page.getByText(originalAgenda).first()).toBeVisible();

		// --- Edit: open the edit form via the row's edit button, change agenda --
		// Scope the edit button to the row carrying our unique agenda.
		const createdRow = page
			.locator('[role="button"]')
			.filter({ hasText: originalAgenda });
		await createdRow.getByRole("button", { name: "Edit Event" }).click();

		await expect(
			page.getByRole("heading", { name: "Edit Event" }),
		).toBeVisible();
		await page.locator("#event-agenda").fill(updatedAgenda);

		const updateResponse = page.waitForResponse(
			(r) =>
				/\/api\/tum-ai-days\/[^/]+$/.test(r.url()) &&
				r.request().method() === "PUT",
		);
		await page.getByRole("button", { name: "Update Event" }).click();
		await updateResponse;
		await expectToast(page, "Event updated successfully!");
		await expect(page.getByText(updatedAgenda).first()).toBeVisible();

		// --- Delete: confirm the window.confirm, then assert removal ----------
		page.once("dialog", (dialog) => dialog.accept());
		const updatedRow = page
			.locator('[role="button"]')
			.filter({ hasText: updatedAgenda });
		const deleteResponse = page.waitForResponse(
			(r) =>
				/\/api\/tum-ai-days\/[^/]+$/.test(r.url()) &&
				r.request().method() === "DELETE",
		);
		await updatedRow.getByRole("button", { name: "Delete Event" }).click();
		await deleteResponse;
		await expectToast(page, "Event deleted successfully");
		await expect(page.getByText(updatedAgenda)).toHaveCount(0);
	});
});

// Sanity: the upcoming seeded event is also present so the list ordering /
// seed parity is covered alongside the past-event audit assertions above.
test("lists both seeded events for the admin", async ({ page }) => {
	await loginAsLocalAdmin(page);
	await page.goto(TUMAI_DAYS_ROUTE);
	await expectAuthenticated(page);

	await expect(
		page.getByRole("heading", { name: "Scheduled Events" }),
	).toBeVisible();
	await expect(page.getByText(UPCOMING_EVENT_AGENDA)).toBeVisible();
	await expect(page.getByText(PAST_EVENT_AGENDA)).toBeVisible();
});
