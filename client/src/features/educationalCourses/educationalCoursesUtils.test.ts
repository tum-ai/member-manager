import { describe, expect, it } from "vitest";
import {
	applicationStatusLabel,
	formatDateRange,
	getPeriodState,
	parseDateOnly,
	serializeDateOnly,
} from "./educationalCoursesUtils";

describe("educational course date utilities", () => {
	it("round trips date only values without UTC conversion", () => {
		const value = "2027-01-03";
		expect(serializeDateOnly(parseDateOnly(value))).toBe(value);
	});

	it("formats an inclusive date range", () => {
		expect(formatDateRange("2026-12-28", "2027-01-03")).toBe(
			"28 Dec 2026 to 3 Jan 2027",
		);
	});

	it("derives open, closed, in progress, and past states", () => {
		expect(
			getPeriodState(
				{
					startsOn: "2027-01-01",
					endsOn: "2027-01-07",
					applicationsOpen: true,
				},
				"2027-01-01",
			),
		).toBe("in_progress");
		expect(
			getPeriodState(
				{
					startsOn: "2027-02-01",
					endsOn: "2027-02-07",
					applicationsOpen: true,
				},
				"2027-01-01",
			),
		).toBe("open");
		expect(
			getPeriodState(
				{
					startsOn: "2027-02-01",
					endsOn: "2027-02-07",
					applicationsOpen: false,
				},
				"2027-01-01",
			),
		).toBe("closed");
		expect(
			getPeriodState(
				{
					startsOn: "2026-12-01",
					endsOn: "2026-12-07",
					applicationsOpen: true,
				},
				"2027-01-01",
			),
		).toBe("past");
	});

	it("uses plain language application labels", () => {
		expect(applicationStatusLabel("pending")).toBe("Pending review");
		expect(applicationStatusLabel("approved")).toBe("Approved");
		expect(applicationStatusLabel("rejected")).toBe("Not selected");
	});
});
