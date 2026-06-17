import { describe, expect, it } from "vitest";
import { buildBatchOptions, getCurrentBatch } from "@/lib/constants";
import { buildSelfServiceMemberUpdatePayload } from "./profileFormUtils";

describe("ProfilePage", () => {
	it("lets self-service profile saves include batch but not role or department", () => {
		// department and member_role are admin-managed (members request changes
		// via member_change_requests), so they must be stripped from self-service
		// saves even when present in the form values.
		expect(
			buildSelfServiceMemberUpdatePayload({
				user_id: "user-123",
				given_name: "Test",
				surname: "User",
				department: "Software Development",
				member_role: "Member",
				degree: "Bachelor Computer Science",
				school: "TUM",
				batch: "WS25",
			}),
		).toEqual({
			user_id: "user-123",
			given_name: "Test",
			surname: "User",
			degree: "Bachelor Computer Science",
			school: "TUM",
			batch: "WS25",
		});
	});

	it("omits empty self-service departments so saves are not blocked", () => {
		expect(
			buildSelfServiceMemberUpdatePayload({
				user_id: "user-123",
				given_name: "Test",
				surname: "User",
				department: "",
				batch: "WS25",
			}),
		).toEqual({
			user_id: "user-123",
			given_name: "Test",
			surname: "User",
			batch: "WS25",
		});
	});

	it("includes admin-managed fields for admins editing their own profile", () => {
		expect(
			buildSelfServiceMemberUpdatePayload(
				{
					user_id: "user-123",
					given_name: "Test",
					surname: "User",
					department: "Venture",
					member_role: "Team Lead",
					batch: "SS25",
				},
				{ includeAdminManagedFields: true },
			),
		).toEqual({
			user_id: "user-123",
			given_name: "Test",
			surname: "User",
			department: "Venture",
			member_role: "Team Lead",
			batch: "SS25",
		});
	});

	it("uses the new semester batch format", () => {
		expect(getCurrentBatch(new Date("2026-01-15T12:00:00Z"))).toBe("WS25");
		expect(getCurrentBatch(new Date("2026-05-15T12:00:00Z"))).toBe("SS26");
		expect(getCurrentBatch(new Date("2026-11-15T12:00:00Z"))).toBe("WS26");
		expect(buildBatchOptions(2024, 2025)).toEqual([
			"WS25",
			"SS25",
			"WS24",
			"SS24",
		]);
	});
});
