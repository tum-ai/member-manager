import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	DOOR_PIN_IMPORT_MAX_ROWS,
	DOOR_PIN_MESSAGE,
	doorPinImportRequestSchema,
	doorPinSchema,
	setDoorPinSchema,
} from "../dist/index.js";

describe("doorPinSchema", () => {
	test("accepts 4 to 10 digits and trims surrounding whitespace", () => {
		assert.equal(doorPinSchema.parse("1234"), "1234");
		assert.equal(doorPinSchema.parse(" 482913 "), "482913");
		assert.equal(doorPinSchema.parse("0123456789"), "0123456789");
	});

	test("rejects PINs that are too short, too long, or not digits", () => {
		for (const pin of ["123", "01234567890", "12a456", "12 34", ""]) {
			const result = doorPinSchema.safeParse(pin);
			assert.equal(result.success, false, pin);
			assert.equal(result.error?.issues[0]?.message, DOOR_PIN_MESSAGE);
		}
	});

	test("setDoorPinSchema requires a pin", () => {
		assert.equal(setDoorPinSchema.safeParse({}).success, false);
		assert.deepEqual(setDoorPinSchema.parse({ pin: "654321" }), {
			pin: "654321",
		});
	});
});

describe("doorPinImportRequestSchema", () => {
	const row = { row_number: 9, email: " Ada@Example.com ", pin: "123456" };

	test("trims rows but leaves per-row validation to the server", () => {
		const parsed = doorPinImportRequestSchema.parse({
			dry_run: true,
			rows: [row, { row_number: 10, email: "not-an-email", pin: "12" }],
		});
		assert.equal(parsed.rows[0]?.email, "Ada@Example.com");
		assert.equal(parsed.rows[1]?.pin, "12");
	});

	test("rejects an empty sheet and more rows than Traka21 can hold", () => {
		assert.equal(
			doorPinImportRequestSchema.safeParse({ dry_run: true, rows: [] }).success,
			false,
		);
		const rows = Array.from(
			{ length: DOOR_PIN_IMPORT_MAX_ROWS + 1 },
			(_, index) => ({ ...row, row_number: index + 1 }),
		);
		assert.equal(
			doorPinImportRequestSchema.safeParse({ dry_run: true, rows }).success,
			false,
		);
	});

	test("requires dry_run to be explicit", () => {
		assert.equal(
			doorPinImportRequestSchema.safeParse({ rows: [row] }).success,
			false,
		);
	});
});
