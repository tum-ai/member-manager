import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	classifyFile,
	countLinesInSource,
	findCrossFeatureImports,
	findStaleAllowlist,
	HARD_LIMIT,
	normalizePosixPath,
	SOFT_LIMIT,
} from "./check-file-size.mjs";

const ALLOWLISTED = "client/src/features/profile/ProfilePage.tsx";

describe("classifyFile size policy", () => {
	test("hard-fails a non-allowlisted gated file over the hard limit", () => {
		const result = classifyFile(
			"client/src/features/jobs/HugePage.tsx",
			HARD_LIMIT + 1,
			{ allowlist: [] },
		);
		assert.equal(result.status, "hard-fail");
		assert.equal(result.limit, HARD_LIMIT);
	});

	test("hard-fails an oversize layout component", () => {
		const result = classifyFile(
			"client/src/components/layout/Sidebar.tsx",
			HARD_LIMIT + 50,
			{ allowlist: [] },
		);
		assert.equal(result.status, "hard-fail");
	});

	test("soft-warns just over the soft limit", () => {
		const result = classifyFile(
			"client/src/features/jobs/MediumPage.tsx",
			SOFT_LIMIT + 1,
		);
		assert.equal(result.status, "soft-warn");
		assert.equal(result.limit, SOFT_LIMIT);
	});

	test("is ok exactly at the soft limit boundary", () => {
		const result = classifyFile(
			"client/src/features/jobs/SmallPage.tsx",
			SOFT_LIMIT,
		);
		assert.equal(result.status, "ok");
	});

	test("does not hard-fail exactly at the hard limit (soft-warn only)", () => {
		const result = classifyFile(
			"client/src/features/jobs/EdgePage.tsx",
			HARD_LIMIT,
			{ allowlist: [] },
		);
		assert.equal(result.status, "soft-warn");
	});

	test("allowlist suppresses hard-fail and reports backlog", () => {
		const result = classifyFile(ALLOWLISTED, 1663, {
			allowlist: [ALLOWLISTED],
		});
		assert.equal(result.status, "allowlisted");
		assert.equal(result.limit, HARD_LIMIT);
	});

	test("allowlist only applies above the hard limit (not at/below)", () => {
		// An allowlisted file that has shrunk to <= the hard limit is classified
		// on its merits, not as "allowlisted" — this is what lets the allowlist
		// be flagged stale and removed.
		assert.equal(
			classifyFile(ALLOWLISTED, SOFT_LIMIT + 1, { allowlist: [ALLOWLISTED] })
				.status,
			"soft-warn",
		);
		assert.equal(
			classifyFile(ALLOWLISTED, SOFT_LIMIT, { allowlist: [ALLOWLISTED] })
				.status,
			"ok",
		);
	});

	test("exempts ui components", () => {
		const result = classifyFile(
			"client/src/components/ui/Table.tsx",
			HARD_LIMIT + 500,
			{ allowlist: [] },
		);
		assert.equal(result.status, "exempt");
	});

	test("exempts .d.ts declarations", () => {
		const result = classifyFile(
			"client/src/features/jobs/types.d.ts",
			HARD_LIMIT + 500,
			{ allowlist: [] },
		);
		assert.equal(result.status, "exempt");
	});

	test("exempts .stories.tsx", () => {
		const result = classifyFile(
			"client/src/features/jobs/JobCard.stories.tsx",
			HARD_LIMIT + 500,
			{ allowlist: [] },
		);
		assert.equal(result.status, "exempt");
	});

	test("exempts .test.tsx and .test.ts", () => {
		assert.equal(
			classifyFile(
				"client/src/features/jobs/JobCard.test.tsx",
				HARD_LIMIT + 500,
				{ allowlist: [] },
			).status,
			"exempt",
		);
		assert.equal(
			classifyFile("client/src/features/jobs/util.test.ts", HARD_LIMIT + 500, {
				allowlist: [],
			}).status,
			"exempt",
		);
	});

	test("ignores files outside gated paths", () => {
		const result = classifyFile("client/src/lib/giant.ts", HARD_LIMIT + 500, {
			allowlist: [],
		});
		assert.equal(result.status, "ignored");
	});
});

describe("normalizePosixPath", () => {
	test("collapses .. and . segments", () => {
		assert.equal(
			normalizePosixPath("client/src/features/jobs/../../lib/x"),
			"client/src/lib/x",
		);
		assert.equal(
			normalizePosixPath("client/src/./features/jobs/./x"),
			"client/src/features/jobs/x",
		);
	});
});

describe("findCrossFeatureImports", () => {
	test("flags a relative import escaping the feature dir", () => {
		const path = "client/src/features/jobs/JobPostingsPage.tsx";
		const source = `import { useToast } from "../../contexts/ToastContext";`;
		const offenders = findCrossFeatureImports(path, source);
		assert.equal(offenders.length, 1);
		assert.equal(offenders[0].specifier, "../../contexts/ToastContext");
		assert.equal(offenders[0].resolved, "client/src/contexts/ToastContext");
	});

	test("flags imports into a sibling feature", () => {
		const path = "client/src/features/jobs/JobPostingsPage.tsx";
		const source = `import { Foo } from "../profile/Foo";`;
		const offenders = findCrossFeatureImports(path, source);
		assert.equal(offenders.length, 1);
		assert.equal(offenders[0].resolved, "client/src/features/profile/Foo");
	});

	test("allows relative imports within the same feature", () => {
		const path = "client/src/features/jobs/JobPostingsPage.tsx";
		const source = [
			`import { JobCard } from "./JobCard";`,
			`import { helper } from "../jobs/lib/helper";`,
			`import { sub } from "./components/sub";`,
		].join("\n");
		assert.deepEqual(findCrossFeatureImports(path, source), []);
	});

	test("ignores alias and bare-package imports", () => {
		const path = "client/src/features/jobs/JobPostingsPage.tsx";
		const source = [
			`import { cn } from "@/lib/utils";`,
			`import { useState } from "react";`,
		].join("\n");
		assert.deepEqual(findCrossFeatureImports(path, source), []);
	});

	test("handles type-only and multiline imports", () => {
		const path = "client/src/features/members/MemberForm.tsx";
		const source = [
			`import type { MemberChangeRequest } from "../../hooks/useAdminData";`,
			`import {`,
			`  DEPARTMENTS,`,
			`} from "../../lib/constants";`,
		].join("\n");
		const offenders = findCrossFeatureImports(path, source);
		assert.equal(offenders.length, 2);
	});

	test("returns nothing for non-feature files", () => {
		const path = "client/src/lib/utils.ts";
		const source = `import { x } from "../../features/jobs/x";`;
		assert.deepEqual(findCrossFeatureImports(path, source), []);
	});

	test("ignores import-like text in line comments and string literals", () => {
		const path = "client/src/features/jobs/JobPostingsPage.tsx";
		const source = [
			`// import { x } from "../../lib/x";`,
			`const s = 'import x from "../../lib/x"';`,
			`const t = "see ../../lib/x for details";`,
		].join("\n");
		assert.deepEqual(findCrossFeatureImports(path, source), []);
	});

	test("ignores import-like text inside block comments", () => {
		const path = "client/src/features/jobs/JobPostingsPage.tsx";
		const source = [
			"/*",
			`import { x } from "../../lib/x";`,
			"*/",
			`import { JobCard } from "./JobCard";`,
		].join("\n");
		assert.deepEqual(findCrossFeatureImports(path, source), []);
	});
});

describe("countLinesInSource", () => {
	test("counts lines with and without a trailing newline", () => {
		assert.equal(countLinesInSource(""), 0);
		assert.equal(countLinesInSource("a"), 1);
		assert.equal(countLinesInSource("a\n"), 1);
		assert.equal(countLinesInSource("a\nb"), 2);
		assert.equal(countLinesInSource("a\nb\n"), 2);
	});
});

describe("findStaleAllowlist", () => {
	const ENTRY = "client/src/features/jobs/JobPostingsPage.tsx";

	test("flags an entry that is no longer tracked", () => {
		const stale = findStaleAllowlist([], new Map(), [ENTRY]);
		assert.equal(stale.length, 1);
		assert.match(stale[0].reason, /no longer tracked/);
	});

	test("flags an entry that has dropped to/below the hard limit", () => {
		const stale = findStaleAllowlist([ENTRY], new Map([[ENTRY, HARD_LIMIT]]), [
			ENTRY,
		]);
		assert.equal(stale.length, 1);
		assert.match(stale[0].reason, /<= 700/);
	});

	test("keeps an entry that is tracked and still over the limit", () => {
		const stale = findStaleAllowlist(
			[ENTRY],
			new Map([[ENTRY, HARD_LIMIT + 1]]),
			[ENTRY],
		);
		assert.deepEqual(stale, []);
	});
});
