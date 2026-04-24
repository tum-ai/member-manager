import "../setup.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	isLocalAdminBootstrapEnabled,
	isLocalAdminEmail,
} from "../../src/lib/localAdmin.js";

describe("local admin helpers", () => {
	test("enables local admin bootstrap only for localhost Supabase URLs", () => {
		assert.equal(isLocalAdminBootstrapEnabled("http://127.0.0.1:54321"), true);
		assert.equal(isLocalAdminBootstrapEnabled("http://localhost:54321"), true);
		assert.equal(
			isLocalAdminBootstrapEnabled("https://project.supabase.co"),
			false,
		);
	});

	test("matches allowlisted emails case-insensitively", () => {
		assert.equal(
			isLocalAdminEmail(
				"Jakob.Friedrich05@gmail.com",
				" other@example.com, jakob.friedrich05@gmail.com ",
			),
			true,
		);
		assert.equal(
			isLocalAdminEmail("missing@example.com", "other@example.com"),
			false,
		);
	});
});
