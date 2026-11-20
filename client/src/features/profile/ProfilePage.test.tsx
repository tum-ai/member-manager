import { describe, expect, it } from "vitest";
import { buildBatchOptions, getCurrentBatch } from "@/lib/constants";

describe("batch options", () => {
	it("uses the new semester batch format", () => {
		expect(getCurrentBatch(new Date("2026-01-15T12:00:00Z"))).toBe("WS25");
		expect(getCurrentBatch(new Date("2026-05-15T12:00:00Z"))).toBe("SS26");
		expect(getCurrentBatch(new Date("2026-11-15T12:00:00Z"))).toBe("WS26");
		expect(buildBatchOptions(2024, 2025)).toEqual([
			"WS25",
			"SS25",
			"WS24",
			"SS24",
		]);
	});
});
