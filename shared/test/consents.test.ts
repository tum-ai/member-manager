import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	DATA_PRIVACY_CONSENT_KEYS,
	hasAllDataPrivacyConsents,
	memberConsentsSchema,
	PRIVACY_ACKNOWLEDGEMENT_MESSAGE,
} from "../dist/index.js";

const allGranted = {
	privacy_policy_agreed: true,
	website_profile_consent: true,
	event_photos_consent: true,
	partner_sharing_consent: true,
};

describe("memberConsentsSchema", () => {
	test("accepts a full decision, including refusals", () => {
		const decision = { ...allGranted, event_photos_consent: false };
		assert.deepEqual(memberConsentsSchema.parse(decision), decision);
	});

	test("rejects a decision that leaves a purpose out", () => {
		const { partner_sharing_consent: _omitted, ...partial } = allGranted;
		const result = memberConsentsSchema.safeParse(partial);
		assert.equal(result.success, false);
		assert.deepEqual(
			result.error?.issues.map((issue) => issue.path.join(".")),
			["partner_sharing_consent"],
		);
	});

	test("requires the Privacy Policy and Data Privacy Notice acknowledgement", () => {
		const result = memberConsentsSchema.safeParse({
			...allGranted,
			privacy_policy_agreed: false,
		});
		assert.equal(result.success, false);
		assert.deepEqual(
			result.error?.issues.map((issue) => [
				issue.path.join("."),
				issue.message,
			]),
			[["privacy_policy_agreed", PRIVACY_ACKNOWLEDGEMENT_MESSAGE]],
		);
	});

	test("rejects non-boolean values", () => {
		assert.equal(
			memberConsentsSchema.safeParse({
				...allGranted,
				privacy_policy_agreed: "yes",
			}).success,
			false,
		);
	});
});

describe("hasAllDataPrivacyConsents", () => {
	test("is true only when every Data Privacy Notice purpose is granted", () => {
		assert.equal(hasAllDataPrivacyConsents(allGranted), true);
		for (const key of DATA_PRIVACY_CONSENT_KEYS) {
			assert.equal(
				hasAllDataPrivacyConsents({ ...allGranted, [key]: false }),
				false,
				key,
			);
		}
	});
});
