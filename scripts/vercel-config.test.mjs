import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function loadRewrites() {
	return JSON.parse(readFileSync("vercel.json", "utf8")).rewrites;
}

function indexOfSource(rewrites, source) {
	const index = rewrites.findIndex((rewrite) => rewrite.source === source);
	assert.notEqual(index, -1, `missing rewrite for ${source}`);
	return index;
}

test("vercel rewrites API routes before falling back to the SPA entry", () => {
	const rewrites = loadRewrites();

	assert.deepEqual(rewrites[indexOfSource(rewrites, "/api/:path*")], {
		source: "/api/:path*",
		destination: "/api/[...path]",
	});
	assert.deepEqual(rewrites[indexOfSource(rewrites, "/:path((?!api/).*)")], {
		source: "/:path((?!api/).*)",
		destination: "/",
	});
	assert.ok(
		indexOfSource(rewrites, "/api/:path*") <
			indexOfSource(rewrites, "/:path((?!api/).*)"),
	);
});

// Vercel evaluates rewrites in order and stops at the first match, so the
// PostHog proxy rules must precede the catch-all SPA fallback - otherwise
// `/ingest/*` is served the index.html shell and analytics silently break.
test("vercel proxies the PostHog /ingest paths before the SPA fallback", () => {
	const rewrites = loadRewrites();
	const spaFallback = indexOfSource(rewrites, "/:path((?!api/).*)");

	const assets = indexOfSource(rewrites, "/ingest/static/:path*");
	const ingest = indexOfSource(rewrites, "/ingest/:path*");

	assert.ok(assets < ingest, "the asset rule must precede the catch-all");
	assert.ok(ingest < spaFallback);
	assert.match(
		rewrites[assets].destination,
		/^https:\/\/[\w-]+\.i\.posthog\.com\//,
	);
	assert.match(
		rewrites[ingest].destination,
		/^https:\/\/[\w.]+\.posthog\.com\//,
	);
});
