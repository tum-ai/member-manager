import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MemberChangeRequest } from "../../hooks/useAdminData";
import {
	CertificateDetailRow,
	formatAdminValue,
	formatCertificateLeadership,
	formatRequestedChanges,
	getMemberDisplayName,
	getSafeHttpUrl,
} from "./adminRequests";
import type { AdminMember } from "./adminUtils";

function member(overrides: Partial<AdminMember>): AdminMember {
	return {
		user_id: "u1",
		given_name: "Ada",
		surname: "Lovelace",
		member_role: "Member",
		department: null,
		...overrides,
	} as unknown as AdminMember;
}

function request(
	changes: MemberChangeRequest["changes"],
	userId = "u1",
): MemberChangeRequest {
	return { id: "r1", user_id: userId, status: "pending", changes };
}

describe("getSafeHttpUrl", () => {
	it("returns null for empty/nullish input", () => {
		expect(getSafeHttpUrl(null)).toBeNull();
		expect(getSafeHttpUrl(undefined)).toBeNull();
		expect(getSafeHttpUrl("")).toBeNull();
	});

	it("accepts http(s) and rejects other protocols and invalid urls", () => {
		expect(getSafeHttpUrl("https://x.com")).toBe("https://x.com");
		expect(getSafeHttpUrl("http://x.com")).toBe("http://x.com");
		expect(getSafeHttpUrl("javascript:alert(1)")).toBeNull();
		expect(getSafeHttpUrl("not a url")).toBeNull();
	});
});

describe("formatAdminValue", () => {
	it("trims strings and falls back to 'Not set'", () => {
		expect(formatAdminValue("  hi  ")).toBe("hi");
		expect(formatAdminValue("   ")).toBe("Not set");
		expect(formatAdminValue(null)).toBe("Not set");
		expect(formatAdminValue(undefined)).toBe("Not set");
		expect(formatAdminValue(42)).toBe("42");
	});
});

describe("formatCertificateLeadership", () => {
	it("combines team lead and special role, trimming blanks", () => {
		expect(
			formatCertificateLeadership({
				isTeamLead: true,
				specialRole: "Treasurer",
			}),
		).toBe("Team Lead, Treasurer");
		expect(
			formatCertificateLeadership({ isTeamLead: true, specialRole: "  " }),
		).toBe("Team Lead");
		expect(formatCertificateLeadership({ specialRole: 5 })).toBe("Member");
		expect(formatCertificateLeadership({})).toBe("Member");
	});
});

describe("getMemberDisplayName", () => {
	const members = [
		member({ user_id: "u1", given_name: "Ada", surname: "Lovelace" }),
	];

	it("returns the full name when found", () => {
		expect(getMemberDisplayName(members, "u1")).toBe("Ada Lovelace");
	});

	it("returns a fallback when missing or unnamed", () => {
		expect(getMemberDisplayName(members, "nope")).toBe("Unknown member");
		expect(
			getMemberDisplayName(
				[member({ user_id: "u2", given_name: "", surname: "" })],
				"u2",
			),
		).toBe("Unknown member");
	});
});

describe("formatRequestedChanges", () => {
	it("lists role, status, degree, school and batch changes", () => {
		const members = [
			member({
				user_id: "u1",
				member_role: "Member",
				member_status: "active",
				degree: "Bachelor",
				school: "TUM",
				batch: "2023",
			}),
		];
		const out = formatRequestedChanges(
			members,
			request({
				member_role: "Team Lead",
				member_status: "alumni",
				degree: "Master",
				school: "LMU",
				batch: "2024",
			}),
		);
		expect(out).toContain("Role: Member -> Team Lead");
		expect(out).toContain("Degree: Bachelor -> Master");
		expect(out).toContain("School: TUM -> LMU");
		expect(out).toContain("Batch: 2023 -> 2024");
		expect(out).toContain("Status:");
	});

	it("reports no changes when nothing differs", () => {
		const members = [member({ user_id: "u1", member_role: "Member" })];
		expect(formatRequestedChanges(members, request({}))).toBe(
			"No requested changes",
		);
	});

	it("handles an unknown member with active fallback", () => {
		const out = formatRequestedChanges(
			[],
			request({ member_status: "alumni" }, "ghost"),
		);
		expect(out).toContain("Status:");
	});
});

describe("CertificateDetailRow", () => {
	it("renders the label and formatted value", () => {
		render(<CertificateDetailRow label="Notes" value={null} />);
		expect(screen.getByText("Notes")).toBeInTheDocument();
		expect(screen.getByText("Not set")).toBeInTheDocument();
	});

	it("preserves whitespace when requested", () => {
		render(
			<CertificateDetailRow
				label="Bio"
				value="multi line"
				preserveWhitespace
			/>,
		);
		expect(screen.getByText("multi line")).toHaveClass("whitespace-pre-wrap");
	});
});
