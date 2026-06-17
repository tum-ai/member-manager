import { describe, expect, it } from "vitest";
import type { PartnerJob } from "@/hooks/useJobs";
import {
	formatDate,
	getApplyHref,
	getApplyLabel,
	getOptionalValue,
	getSafeHttpUrl,
	getStatusBadgeVariant,
} from "./jobPostingsUtils";

function makeJob(overrides: Partial<PartnerJob> = {}): PartnerJob {
	return {
		id: "job-1",
		title: "ML Engineer",
		partner: { name: "Example Partner", logo_url: null },
		logo_url: null,
		description_markdown: "Build models.",
		call_to_action: "Apply now",
		job_type: "internship",
		location: "Munich",
		contact: { name: "Dr. Example", email: "jobs@example.com", role: null },
		external_url: null,
		published_at: "2026-05-20T10:00:00.000Z",
		expires_at: null,
		...overrides,
	};
}

describe("formatDate", () => {
	it("formats a valid ISO date", () => {
		expect(formatDate("2026-05-20T10:00:00.000Z")).toBe("May 20, 2026");
	});

	it("returns the raw value for an invalid date", () => {
		expect(formatDate("not-a-date")).toBe("not-a-date");
	});
});

describe("getOptionalValue", () => {
	it("trims and returns non-empty values", () => {
		expect(getOptionalValue("  hello  ")).toBe("hello");
	});

	it("returns null for blank values", () => {
		expect(getOptionalValue("   ")).toBeNull();
		expect(getOptionalValue("")).toBeNull();
	});
});

describe("getSafeHttpUrl", () => {
	it("accepts https and http URLs", () => {
		expect(getSafeHttpUrl("https://example.com")).toBe("https://example.com");
		expect(getSafeHttpUrl("http://example.com")).toBe("http://example.com");
	});

	it("rejects non-http(s) protocols", () => {
		expect(getSafeHttpUrl("javascript:alert(1)")).toBeNull();
		expect(getSafeHttpUrl("mailto:x@example.com")).toBeNull();
	});

	it("returns null for empty or malformed input", () => {
		expect(getSafeHttpUrl(null)).toBeNull();
		expect(getSafeHttpUrl(undefined)).toBeNull();
		expect(getSafeHttpUrl("not a url")).toBeNull();
	});
});

describe("getStatusBadgeVariant", () => {
	it("maps statuses to badge variants", () => {
		expect(getStatusBadgeVariant("approved")).toBe("success");
		expect(getStatusBadgeVariant("rejected")).toBe("danger");
		expect(getStatusBadgeVariant("pending")).toBe("warning");
	});
});

describe("getApplyHref", () => {
	it("uses a safe external URL when present", () => {
		expect(
			getApplyHref(makeJob({ external_url: "https://jobs.example.com" })),
		).toBe("https://jobs.example.com");
	});

	it("falls back to a mailto link otherwise", () => {
		expect(getApplyHref(makeJob({ external_url: null }))).toBe(
			"mailto:jobs@example.com",
		);
	});

	it("falls back to mailto for unsafe protocols", () => {
		expect(getApplyHref(makeJob({ external_url: "javascript:alert(1)" }))).toBe(
			"mailto:jobs@example.com",
		);
	});
});

describe("getApplyLabel", () => {
	it("prefers the trimmed call to action", () => {
		expect(getApplyLabel(makeJob({ call_to_action: "  Apply  " }))).toBe(
			"Apply",
		);
	});

	it("defaults to Open posting for a safe external URL", () => {
		expect(
			getApplyLabel(
				makeJob({ call_to_action: "", external_url: "https://x.example" }),
			),
		).toBe("Open posting");
	});

	it("defaults to Contact without an external URL", () => {
		expect(
			getApplyLabel(makeJob({ call_to_action: "", external_url: null })),
		).toBe("Contact");
	});
});
