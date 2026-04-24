import { describe, expect, it } from "vitest";
import { buildSelfServiceMemberUpdatePayload } from "./profileFormUtils";

describe("ProfilePage", () => {
	it("does not send admin-managed fields in the self-service profile update payload", () => {
		expect(
			buildSelfServiceMemberUpdatePayload({
				user_id: "user-123",
				given_name: "Test",
				surname: "User",
				department: "Software Development",
				member_role: "Member",
				degree: "B.Sc. Computer Science",
				school: "TUM",
				batch: "WS25/26",
			}),
		).toEqual({
			user_id: "user-123",
			given_name: "Test",
			surname: "User",
			degree: "B.Sc. Computer Science",
			school: "TUM",
			batch: "WS25/26",
		});
	});
});
