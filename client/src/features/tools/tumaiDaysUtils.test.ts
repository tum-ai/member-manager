import { describe, expect, it } from "vitest";
import type { RSVPResponse } from "./tumaiDaysTypes";
import {
	computeResponseRate,
	filterResponses,
	formatDate,
	toLocalDateTimeInput,
} from "./tumaiDaysUtils";

function makeResponse(overrides: Partial<RSVPResponse> = {}): RSVPResponse {
	return {
		userId: "u1",
		givenName: "Ada",
		surname: "Lovelace",
		email: "ada@tum.ai",
		department: "Engineering",
		status: "pending",
		reason: null,
		votedAt: null,
		...overrides,
	};
}

describe("formatDate", () => {
	it("formats an ISO string with medium date + short time", () => {
		// Use UTC midday to keep the rendered day stable across timezones.
		expect(formatDate("2026-01-15T12:00:00.000Z")).toMatch(/Jan 15, 2026/);
	});
});

describe("toLocalDateTimeInput", () => {
	it("returns a YYYY-MM-DDTHH:MM string parseable back to the same instant", () => {
		const iso = "2026-03-09T18:30:00.000Z";
		const local = toLocalDateTimeInput(iso);
		expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
		// Round-trips: parsing the local string yields the original instant.
		expect(new Date(local).toISOString()).toBe(iso);
	});

	it("zero-pads single-digit month, day, hour, and minute", () => {
		// Construct a local date with single-digit parts.
		const d = new Date(2026, 0, 5, 4, 7);
		const local = toLocalDateTimeInput(d.toISOString());
		expect(local).toBe("2026-01-05T04:07");
	});
});

describe("filterResponses", () => {
	const rows = [
		makeResponse({
			userId: "1",
			givenName: "Ada",
			surname: "Lovelace",
			status: "yes",
		}),
		makeResponse({
			userId: "2",
			givenName: "Alan",
			surname: "Turing",
			email: "alan@tum.ai",
			status: "no",
		}),
		makeResponse({
			userId: "3",
			givenName: "Grace",
			surname: "Hopper",
			email: "grace@navy.mil",
			status: "pending",
		}),
	];

	it("returns all rows for empty search and 'all' filter", () => {
		expect(filterResponses(rows, "", "all")).toHaveLength(3);
	});

	it("matches by name case-insensitively", () => {
		const result = filterResponses(rows, "grace", "all");
		expect(result.map((r) => r.userId)).toEqual(["3"]);
	});

	it("matches by email", () => {
		const result = filterResponses(rows, "navy.mil", "all");
		expect(result.map((r) => r.userId)).toEqual(["3"]);
	});

	it("filters by status", () => {
		const result = filterResponses(rows, "", "no");
		expect(result.map((r) => r.userId)).toEqual(["2"]);
	});

	it("combines search and status (AND)", () => {
		expect(filterResponses(rows, "alan", "yes")).toHaveLength(0);
		expect(filterResponses(rows, "alan", "no")).toHaveLength(1);
	});
});

describe("computeResponseRate", () => {
	it("returns 0 when stats are undefined", () => {
		expect(computeResponseRate(undefined)).toBe(0);
	});

	it("returns 0 when total is 0", () => {
		expect(computeResponseRate({ yes: 0, no: 0, pending: 0, total: 0 })).toBe(
			0,
		);
	});

	it("rounds (yes + no) / total to a whole percent", () => {
		expect(computeResponseRate({ yes: 1, no: 2, pending: 0, total: 4 })).toBe(
			75,
		);
		// 1/3 -> 33.33 -> 33
		expect(computeResponseRate({ yes: 1, no: 0, pending: 2, total: 3 })).toBe(
			33,
		);
	});
});
