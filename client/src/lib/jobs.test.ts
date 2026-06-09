import { describe, expect, it } from "vitest";
import { fetchAllPartnerJobPages } from "./jobs";

describe("fetchAllPartnerJobPages", () => {
	it("loads every page until the Partner Portal cursor is exhausted", async () => {
		const requestedCursors: Array<string | null> = [];

		const result = await fetchAllPartnerJobPages(async (cursor) => {
			requestedCursors.push(cursor);
			if (cursor === null) {
				return { data: ["job-a"], next_cursor: "cursor-1" };
			}
			return { data: ["job-b"], next_cursor: null };
		});

		expect(result).toEqual({ data: ["job-a", "job-b"], next_cursor: null });
		expect(requestedCursors).toEqual([null, "cursor-1"]);
	});

	it("rejects repeated cursors instead of looping forever", async () => {
		await expect(
			fetchAllPartnerJobPages(async () => ({
				data: [],
				next_cursor: "cursor-1",
			})),
		).rejects.toThrow(/repeated cursor/i);
	});
});
