import "../setup.js";
import assert from "node:assert";
import { describe, test } from "node:test";
import {
	isOwnedReceiptStoragePath,
	receiptStoragePath,
} from "../../src/lib/reimbursementReceipts.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";

describe("isOwnedReceiptStoragePath", () => {
	test("accepts the keys receiptStoragePath mints for the user", () => {
		const path = receiptStoragePath({
			userId: USER_ID,
			filename: "Taxi Rechnung (März).pdf",
			mimeType: "application/pdf",
		});
		assert.strictEqual(isOwnedReceiptStoragePath(USER_ID, path), true);
		assert.strictEqual(isOwnedReceiptStoragePath(OTHER_ID, path), false);
	});

	test("rejects keys that resolve into another member's folder", () => {
		// URL parsing resolves these, so the storage client would read
		// `<OTHER_ID>/receipt.pdf` (or leave the bucket) with the service key.
		for (const path of [
			`${USER_ID}/../${OTHER_ID}/receipt.pdf`,
			`${USER_ID}/%2e%2e/${OTHER_ID}/receipt.pdf`,
			`${USER_ID}/..`,
			`${USER_ID}/.`,
			`${USER_ID}/../../other-bucket/file.pdf`,
			`${USER_ID}/nested/receipt.pdf`,
			`${USER_ID}//receipt.pdf`,
			`${USER_ID}/..\\${OTHER_ID}\\receipt.pdf`,
			`${USER_ID}/`,
			`/${USER_ID}/receipt.pdf`,
			`${USER_ID}-evil/receipt.pdf`,
			`${OTHER_ID}/receipt.pdf`,
		]) {
			assert.strictEqual(isOwnedReceiptStoragePath(USER_ID, path), false, path);
		}
	});
});
