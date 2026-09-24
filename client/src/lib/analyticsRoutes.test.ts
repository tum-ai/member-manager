import { describe, expect, it } from "vitest";
import { getFeatureNameForPath } from "./analyticsRoutes";

describe("getFeatureNameForPath", () => {
	it("maps the landing route to profile", () => {
		expect(getFeatureNameForPath("/")).toBe("profile");
	});

	it("maps reimbursement review before the plain reimbursement route", () => {
		expect(getFeatureNameForPath("/tools/reimbursement/review")).toBe(
			"reimbursements-review",
		);
		expect(getFeatureNameForPath("/tools/reimbursement")).toBe(
			"reimbursements",
		);
	});

	it("maps nested members routes to their specific feature", () => {
		expect(getFeatureNameForPath("/members/org-tree")).toBe("members-org-tree");
		expect(getFeatureNameForPath("/members")).toBe("members");
	});

	it("maps contract sub-routes to distinct features", () => {
		expect(getFeatureNameForPath("/contracts/submissions/abc-123")).toBe(
			"contracts-submissions",
		);
		expect(getFeatureNameForPath("/contracts/drafts/abc-123")).toBe(
			"contracts",
		);
		expect(getFeatureNameForPath("/contracts/sign/some-token")).toBe(
			"contracts-partner-sign",
		);
	});

	it("falls back to profile for unknown routes", () => {
		expect(getFeatureNameForPath("/something/unmapped")).toBe("profile");
	});

	it("does not match a prefix as a substring of an unrelated segment", () => {
		expect(getFeatureNameForPath("/members-directory")).toBe("profile");
	});
});
