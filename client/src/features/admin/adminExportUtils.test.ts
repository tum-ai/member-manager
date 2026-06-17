import { describe, expect, it } from "vitest";
import { buildExportRows, escapeCsvCell, rowsToCsv } from "./adminExportUtils";
import type { AdminMember } from "./adminUtils";

function makeMember(overrides: Partial<AdminMember> = {}): AdminMember {
	return {
		user_id: "u-1",
		given_name: "Alice",
		surname: "Example",
		email: "alice@example.com",
		phone: "+49 123",
		department: "Software Development",
		member_role: "Member",
		board_role: null,
		member_status: "active",
		active: true,
		linkedin_profile_url: "https://linkedin.com/in/alice",
		public_location: "Munich",
		sepa: {
			iban: "DE89",
			bic: "COBADEFF",
			bank_name: "Bank",
			mandate_agreed: true,
			privacy_agreed: false,
			data_privacy_notice_agreed: true,
		},
		...overrides,
	} as AdminMember;
}

describe("adminExportUtils", () => {
	describe("buildExportRows", () => {
		it("maps a member to a flat export row with agreement labels", () => {
			const [row] = buildExportRows([makeMember()]);

			expect(row).toMatchObject({
				Surname: "Example",
				"Given Name": "Alice",
				Email: "alice@example.com",
				Department: "Software Development",
				IBAN: "DE89",
				BIC: "COBADEFF",
				"SEPA Mandate": "Accepted",
				"Privacy Agreed": "Not accepted",
				"Data Privacy Notice": "Accepted",
				Status: "Active",
			});
		});

		it("falls back to empty strings and active/inactive status", () => {
			const [row] = buildExportRows([
				makeMember({
					member_status: "",
					active: false,
					linkedin_profile_url: "",
					public_location: "",
					board_role: null,
					sepa: null,
				}),
			]);

			expect(row.IBAN).toBe("");
			expect(row.BIC).toBe("");
			expect(row["LinkedIn URL"]).toBe("");
			expect(row["SEPA Mandate"]).toBe("Not accepted");
			expect(row.Status).toBe("Inactive");
		});
	});

	describe("escapeCsvCell", () => {
		it("leaves plain values untouched", () => {
			expect(escapeCsvCell("plain")).toBe("plain");
		});

		it("quotes and escapes values with separators or quotes", () => {
			expect(escapeCsvCell("a,b")).toBe('"a,b"');
			expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
			expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
		});
	});

	describe("rowsToCsv", () => {
		it("returns an empty string for no rows", () => {
			expect(rowsToCsv([])).toBe("");
		});

		it("builds a CRLF-delimited CSV with a header row", () => {
			const csv = rowsToCsv([
				{ Name: "Alice", Note: "a,b" },
				{ Name: "Bob", Note: "plain" },
			]);

			expect(csv).toBe('Name,Note\r\nAlice,"a,b"\r\nBob,plain\r\n');
		});
	});
});
