import "../setup.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	isLocalAdminBootstrapEnabled,
	isLocalAdminEmail,
} from "../../src/lib/localAdmin.js";

describe("local admin helpers", () => {
	test("enables local admin bootstrap only for localhost Supabase URLs", () => {
		assert.equal(
			isLocalAdminBootstrapEnabled(
				"http://127.0.0.1:54321",
				"true",
				"development",
			),
			true,
		);
		assert.equal(
			isLocalAdminBootstrapEnabled(
				"http://localhost:54321",
				"true",
				"development",
			),
			true,
		);
		assert.equal(
			isLocalAdminBootstrapEnabled(
				"https://project.supabase.co",
				"true",
				"development",
			),
			false,
		);
		assert.equal(
			isLocalAdminBootstrapEnabled(
				"http://127.0.0.1:54321",
				"false",
				"development",
			),
			false,
		);
		assert.equal(
			isLocalAdminBootstrapEnabled(
				"http://127.0.0.1:54321",
				"true",
				"production",
			),
			false,
		);
	});

	test("matches allowlisted emails case-insensitively", () => {
		assert.equal(
			isLocalAdminEmail(
				"User@example.com",
				" other@example.com, user@example.com ",
			),
			true,
		);
		assert.equal(
			isLocalAdminEmail("missing@example.com", "other@example.com"),
			false,
		);
	});
});
