import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("vercel rewrites API routes before falling back to the SPA entry", () => {
	const config = JSON.parse(readFileSync("vercel.json", "utf8"));

	assert.deepEqual(config.rewrites[0], {
		source: "/api/:path*",
		destination: "/api/[...path]",
	});
	assert.deepEqual(config.rewrites[1], {
		source: "/:path((?!api/).*)",
		destination: "/",
	});
});
