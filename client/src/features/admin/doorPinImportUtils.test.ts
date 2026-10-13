import { describe, expect, it } from "vitest";
import {
	cellText,
	DoorPinSheetError,
	parseTrakaUserSheet,
	type SheetCell,
} from "./doorPinImportUtils";

const HEADER: SheetCell[] = [
	"Vorname",
	"Nachname",
	"Kontakt",
	"UserID",
	"PIN",
	"Admin",
	"PIN-Änderung erzwingen",
	"Ablaufdatum",
	"Löschen",
	"1",
];

// The cabinet export: title rows, a header on row 8, then users from row 9.
function trakaSheet(users: SheetCell[][]): SheetCell[][] {
	return [
		[null, "Traka21 Benutzer & Schlüssel"],
		["Exportdatum:", "09/10/2026 17:29:34"],
		["Exportiert von:", "T21M0000000"],
		["Exportiert durch:", "admin"],
		["V2.1"],
		["Dieses Arbeitsblatt dient dazu, Benutzer … zu verwalten."],
		[
			"Allgemeine Benutzerinformationen",
			null,
			null,
			null,
			null,
			null,
			"Fortgeschrittene Benutzerinformationen",
		],
		HEADER,
		...users,
	];
}

describe("parseTrakaUserSheet", () => {
	it("reads users below the header with their spreadsheet row numbers", () => {
		const { rows, skipped } = parseTrakaUserSheet(
			trakaSheet([
				[
					"Ada",
					"Lovelace",
					"Ada@Example.com ",
					null,
					482913,
					null,
					null,
					null,
					null,
					"Y",
				],
				[
					"Grace",
					"Hopper",
					"grace@example.com",
					null,
					"135790",
					null,
					null,
					null,
					null,
					"Y",
				],
			]),
		);

		expect(rows).toEqual([
			{
				row_number: 9,
				email: "Ada@Example.com",
				pin: "482913",
				given_name: "Ada",
				surname: "Lovelace",
			},
			{
				row_number: 10,
				email: "grace@example.com",
				pin: "135790",
				given_name: "Grace",
				surname: "Hopper",
			},
		]);
		expect(skipped).toEqual([]);
	});

	it("leaves out the cabinet admin, deleted users and incomplete rows", () => {
		const { rows, skipped } = parseTrakaUserSheet(
			trakaSheet([
				["admin", "tum.ai", "it@example.com", "uuid", "ab12", "Y"],
				[
					"Alan",
					"Turing",
					"alan@example.com",
					null,
					111111,
					null,
					null,
					null,
					"Y",
				],
				["No", "Email", null, null, 222222],
				["No", "Pin", "nopin@example.com"],
				[null, null, null, null, null],
				["Ada", "Lovelace", "ada@example.com", null, 333333],
			]),
		);

		expect(rows.map((row) => row.row_number)).toEqual([14]);
		expect(skipped).toEqual([
			{
				row_number: 9,
				email: "it@example.com",
				name: "admin tum.ai",
				reason: "cabinet_admin",
			},
			{
				row_number: 10,
				email: "alan@example.com",
				name: "Alan Turing",
				reason: "marked_for_deletion",
			},
			{ row_number: 11, email: "", name: "No Email", reason: "missing_email" },
			{
				row_number: 12,
				email: "nopin@example.com",
				name: "No Pin",
				reason: "missing_pin",
			},
		]);
	});

	it("accepts English headers in any column order", () => {
		const { rows } = parseTrakaUserSheet([
			["PIN", "Email", "First name", "Last name"],
			["0042", "ada@example.com", "Ada", "Lovelace"],
		]);

		expect(rows).toEqual([
			{
				row_number: 2,
				email: "ada@example.com",
				pin: "0042",
				given_name: "Ada",
				surname: "Lovelace",
			},
		]);
	});

	it("rejects a sheet without the Kontakt and PIN columns", () => {
		expect(() =>
			parseTrakaUserSheet([
				["Name", "Email"],
				["Ada", "ada@example.com"],
			]),
		).toThrow(DoorPinSheetError);
	});

	it("rejects a sheet without any user rows", () => {
		expect(() => parseTrakaUserSheet(trakaSheet([]))).toThrow(
			"The sheet has no user rows with a PIN.",
		);
	});

	it("rejects more users than the cabinet holds", () => {
		const users = Array.from({ length: 1001 }, (_, index) => [
			"User",
			String(index),
			`user${index}@example.com`,
			null,
			100000 + index,
		]);
		expect(() => parseTrakaUserSheet(trakaSheet(users))).toThrow(
			/holds at most 1000/,
		);
	});
});

describe("cellText", () => {
	it("writes whole numbers without exponents and trims strings", () => {
		expect(cellText(482913)).toBe("482913");
		expect(cellText(1e21)).toBe("1000000000000000000000");
		expect(cellText("  12 ")).toBe("12");
		expect(cellText(null)).toBe("");
		expect(cellText(true)).toBe("");
		expect(cellText(Number.NaN)).toBe("");
	});
});
