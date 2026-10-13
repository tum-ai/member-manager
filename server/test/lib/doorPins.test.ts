import "../setup.js";
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { DoorPinImportRow } from "@member-manager/shared";
import { listAuthUserIdsByEmail } from "../../src/lib/authEmails.js";
import {
	type DoorPinImportPlanInput,
	type DoorPinMember,
	findPinHolder,
	planDoorPinImport,
} from "../../src/lib/doorPins.js";
import { setSupabaseClient } from "../../src/lib/supabase.js";
import {
	createMockSupabaseClient,
	MOCK_ADMIN_ID,
	MOCK_OTHER_USER_ID,
	MOCK_USER_ID,
} from "../mocks/supabase.js";

const ada: DoorPinMember = {
	user_id: "ada",
	given_name: "Ada",
	surname: "Lovelace",
	member_status: "active",
};
const grace: DoorPinMember = {
	user_id: "grace",
	given_name: "Grace",
	surname: "Hopper",
	member_status: "active",
};
const alan: DoorPinMember = {
	user_id: "alan",
	given_name: "Alan",
	surname: "Turing",
	member_status: "alumni",
};

function row(
	rowNumber: number,
	email: string,
	pin: string,
	name: Partial<DoorPinImportRow> = {},
): DoorPinImportRow {
	return { row_number: rowNumber, email, pin, ...name };
}

function plan(
	rows: DoorPinImportRow[],
	overrides: Partial<DoorPinImportPlanInput> = {},
) {
	return planDoorPinImport({
		rows,
		userIdsByEmail: new Map([
			["ada@example.com", "ada"],
			["grace@example.com", "grace"],
			["alan@example.com", "alan"],
			["no-member@example.com", "orphan-account"],
		]),
		members: [ada, grace, alan],
		existingPins: new Map(),
		emailsByUserId: new Map([
			["ada", "ada@example.com"],
			["grace", "grace@example.com"],
			["alan", "alan@example.com"],
		]),
		...overrides,
	});
}

describe("planDoorPinImport", () => {
	test("matches emails case-insensitively and plans new PINs", () => {
		const { result, writes } = plan([
			row(9, " Ada@Example.COM ", "111111", {
				given_name: "Ada",
				surname: "Lovelace",
			}),
			row(10, "grace@example.com", "222222"),
		]);

		assert.deepEqual(writes, [
			{ user_id: "ada", pin: "111111" },
			{ user_id: "grace", pin: "222222" },
		]);
		assert.equal(result.total, 2);
		assert.equal(result.matched, 2);
		assert.equal(result.created, 2);
		assert.deepEqual(result.unmatched, []);
		assert.deepEqual(result.rejected, []);
		assert.deepEqual(result.members_without_pin, []);
	});

	test("classifies updated and unchanged PINs and only writes changes", () => {
		const { result, writes } = plan(
			[
				row(9, "ada@example.com", "111111"),
				row(10, "grace@example.com", "999999"),
			],
			{
				existingPins: new Map([
					["ada", "111111"],
					["grace", "222222"],
				]),
			},
		);

		assert.equal(result.unchanged, 1);
		assert.equal(result.updated, 1);
		assert.deepEqual(writes, [{ user_id: "grace", pin: "999999" }]);
	});

	test("reports emails without a member account as unmatched", () => {
		const { result, writes } = plan([
			row(9, "stranger@example.com", "111111", {
				given_name: "Some",
				surname: "One",
			}),
			row(10, "no-member@example.com", "222222"),
		]);

		assert.deepEqual(writes, []);
		assert.deepEqual(result.unmatched, [
			{ row_number: 9, email: "stranger@example.com", name: "Some One" },
			{ row_number: 10, email: "no-member@example.com", name: "" },
		]);
	});

	test("rejects invalid emails and PINs", () => {
		const { result } = plan([
			row(9, "not-an-email", "111111"),
			row(10, "ada@example.com", "12ab"),
			row(11, "grace@example.com", "123"),
		]);

		assert.deepEqual(
			result.rejected.map((rejected) => [rejected.row_number, rejected.reason]),
			[
				[9, "invalid_email"],
				[10, "invalid_pin"],
				[11, "invalid_pin"],
			],
		);
	});

	test("rejects every copy of a repeated email or PIN", () => {
		const { result, writes } = plan([
			row(9, "ada@example.com", "111111"),
			row(10, "ADA@example.com", "222222"),
			row(11, "grace@example.com", "333333"),
			row(12, "alan@example.com", "333333"),
		]);

		assert.deepEqual(writes, []);
		assert.deepEqual(
			result.rejected.map((rejected) => [rejected.row_number, rejected.reason]),
			[
				[9, "duplicate_email"],
				[10, "duplicate_email"],
				[11, "duplicate_pin"],
				[12, "duplicate_pin"],
			],
		);
	});

	test("rejects a PIN a member outside the sheet keeps", () => {
		const { result, writes } = plan([row(9, "ada@example.com", "222222")], {
			existingPins: new Map([["grace", "222222"]]),
		});

		assert.deepEqual(writes, []);
		assert.equal(result.rejected[0]?.reason, "pin_in_use");
	});

	test("allows members in the sheet to swap PINs", () => {
		const { result, writes } = plan(
			[
				row(9, "ada@example.com", "222222"),
				row(10, "grace@example.com", "111111"),
			],
			{
				existingPins: new Map([
					["ada", "111111"],
					["grace", "222222"],
				]),
			},
		);

		assert.deepEqual(result.rejected, []);
		assert.equal(result.updated, 2);
		assert.equal(writes.length, 2);
	});

	test("a rejected row keeps its member's old PIN, which can block another row", () => {
		// Grace's row is invalid, so she keeps 222222 and Ada can't take it.
		const { result, writes } = plan(
			[
				row(9, "ada@example.com", "222222"),
				row(10, "grace@example.com", "nope"),
			],
			{ existingPins: new Map([["grace", "222222"]]) },
		);

		assert.deepEqual(writes, []);
		assert.deepEqual(
			result.rejected.map((rejected) => [rejected.row_number, rejected.reason]),
			[
				[9, "pin_in_use"],
				[10, "invalid_pin"],
			],
		);
	});

	test("lists active members who still have no PIN", () => {
		const { result } = plan([row(9, "ada@example.com", "111111")]);

		// Alan is an alumnus, so only Grace is listed.
		assert.deepEqual(result.members_without_pin, [
			{ user_id: "grace", name: "Grace Hopper", email: "grace@example.com" },
		]);
	});

	test("never returns a PIN", () => {
		const { result } = plan([
			row(9, "ada@example.com", "111111"),
			row(10, "stranger@example.com", "222222"),
			row(11, "ada@example.com", "333333"),
		]);

		assert.doesNotMatch(JSON.stringify(result), /111111|222222|333333/);
	});
});

describe("findPinHolder", () => {
	test("finds another member with the same PIN, ignoring the member themself", () => {
		const pins = new Map([
			["ada", "111111"],
			["grace", "222222"],
		]);

		assert.equal(findPinHolder(pins, "222222", "ada"), "grace");
		assert.equal(findPinHolder(pins, "111111", "ada"), null);
		assert.equal(findPinHolder(pins, "333333", "ada"), null);
	});
});

describe("listAuthUserIdsByEmail", () => {
	before(() => {
		setSupabaseClient(createMockSupabaseClient());
	});

	test("maps every auth user's normalized email to their id", async () => {
		const userIdsByEmail = await listAuthUserIdsByEmail();

		assert.equal(userIdsByEmail.get("user@test.com"), MOCK_USER_ID);
		assert.equal(userIdsByEmail.get("admin@test.com"), MOCK_ADMIN_ID);
		assert.equal(userIdsByEmail.get("other@test.com"), MOCK_OTHER_USER_ID);
	});
});
