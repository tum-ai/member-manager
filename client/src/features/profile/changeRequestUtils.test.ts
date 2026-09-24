import { describe, expect, it } from "vitest";
import type { MemberChangeRequest } from "@/hooks/useMemberChangeRequests";
import {
	describeRequestedChanges,
	formatChangeRequestDate,
	getChangeRequestStatusBadgeVariant,
	getChangeRequestStatusLabel,
	partitionChangeRequests,
} from "./changeRequestUtils";

function request(
	id: string,
	status: MemberChangeRequest["status"],
): MemberChangeRequest {
	return { id, user_id: "user-1", status, changes: {} };
}

describe("describeRequestedChanges", () => {
	it("describes an executive role without a department", () => {
		expect(
			describeRequestedChanges({
				member_role: "President",
				department: null,
			}),
		).toEqual([{ label: "Role", value: "President" }]);
	});

	it("drops a stray department for executive roles", () => {
		expect(
			describeRequestedChanges({
				member_role: "Vice-President",
				department: "Marketing",
			}),
		).toEqual([{ label: "Role", value: "Vice-President" }]);
	});

	it("keeps the department for roles that require one", () => {
		expect(
			describeRequestedChanges({
				member_role: "Team Lead",
				department: "Marketing",
			}),
		).toEqual([
			{ label: "Role", value: "Team Lead" },
			{ label: "Department", value: "Marketing" },
		]);
	});

	it("describes department-only and status requests with readable labels", () => {
		expect(describeRequestedChanges({ department: "Research" })).toEqual([
			{ label: "Department", value: "Research" },
		]);
		expect(
			describeRequestedChanges({ member_status: "alumni", batch: "WS22" }),
		).toEqual([
			{ label: "Status", value: "Alumni" },
			{ label: "Batch", value: "WS22" },
		]);
	});

	it("includes degree and school, skipping blank values", () => {
		expect(
			describeRequestedChanges({
				department: "  ",
				degree: "M.Sc. Computer Science",
				school: "TUM",
				batch: null,
			}),
		).toEqual([
			{ label: "Degree", value: "M.Sc. Computer Science" },
			{ label: "School", value: "TUM" },
		]);
	});

	it("returns no entries for an empty change set", () => {
		expect(describeRequestedChanges({})).toEqual([]);
	});
});

describe("change request status", () => {
	it("maps each status to a text label and badge variant", () => {
		expect(getChangeRequestStatusLabel("pending")).toBe("Pending");
		expect(getChangeRequestStatusLabel("approved")).toBe("Approved");
		expect(getChangeRequestStatusLabel("rejected")).toBe("Rejected");
		expect(getChangeRequestStatusBadgeVariant("pending")).toBe("warning");
		expect(getChangeRequestStatusBadgeVariant("approved")).toBe("success");
		expect(getChangeRequestStatusBadgeVariant("rejected")).toBe("danger");
	});

	it("falls back for statuses the client does not know", () => {
		const unknown = "withdrawn" as MemberChangeRequest["status"];
		expect(getChangeRequestStatusLabel(unknown)).toBe("withdrawn");
		expect(getChangeRequestStatusBadgeVariant(unknown)).toBe("neutral");
	});
});

describe("formatChangeRequestDate", () => {
	it("formats an ISO timestamp", () => {
		// Midday UTC keeps the calendar date stable across test-runner timezones.
		expect(formatChangeRequestDate("2026-04-24T12:00:00Z")).toBe(
			"Apr 24, 2026",
		);
	});

	it("returns null for missing or invalid values", () => {
		expect(formatChangeRequestDate(undefined)).toBeNull();
		expect(formatChangeRequestDate(null)).toBeNull();
		expect(formatChangeRequestDate("not-a-date")).toBeNull();
	});
});

describe("partitionChangeRequests", () => {
	it("splits pending from reviewed requests, preserving order", () => {
		const { pending, reviewed } = partitionChangeRequests([
			request("a", "pending"),
			request("b", "rejected"),
			request("c", "pending"),
			request("d", "approved"),
		]);

		expect(pending.map((entry) => entry.id)).toEqual(["a", "c"]);
		expect(reviewed.map((entry) => entry.id)).toEqual(["b", "d"]);
	});
});
