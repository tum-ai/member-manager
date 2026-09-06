import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	getReimbursementSubmissionTypeLabel,
	isVividReimbursementEligibleMember,
	REIMBURSEMENT_PAYMENT_STATUSES,
	REIMBURSEMENT_SUBMISSION_TYPES,
	reimbursementRequiresPayout,
	reimbursementSubmissionTypeSchema,
} from "../dist/index.js";

describe("reimbursement contracts", () => {
	test("exposes the Vivid submission and non-payout payment states", () => {
		assert.deepStrictEqual(REIMBURSEMENT_SUBMISSION_TYPES, [
			"reimbursement",
			"invoice",
			"vivid_reimbursement",
		]);
		assert.deepStrictEqual(REIMBURSEMENT_PAYMENT_STATUSES, [
			"to_be_paid",
			"paid",
			"not_required",
		]);
		assert.strictEqual(
			reimbursementSubmissionTypeSchema.parse("vivid_reimbursement"),
			"vivid_reimbursement",
		);
	});

	test("requires active leadership roles for Vivid eligibility", () => {
		for (const member_role of ["Team Lead", "President", "Vice-President"]) {
			assert.strictEqual(
				isVividReimbursementEligibleMember({
					member_role,
					member_status: "active",
					active: true,
				}),
				true,
			);
		}
		assert.strictEqual(
			isVividReimbursementEligibleMember({
				member_role: "Team Lead",
				member_status: "inactive",
				active: false,
			}),
			false,
		);
		assert.strictEqual(
			isVividReimbursementEligibleMember({
				member_role: "Member",
				member_status: "active",
				active: true,
			}),
			false,
		);
	});

	test("labels Vivid requests and excludes them from payout totals", () => {
		assert.strictEqual(
			getReimbursementSubmissionTypeLabel("vivid_reimbursement"),
			"Vivid Reimbursement",
		);
		assert.strictEqual(
			reimbursementRequiresPayout("vivid_reimbursement"),
			false,
		);
		assert.strictEqual(reimbursementRequiresPayout("reimbursement"), true);
	});
});
