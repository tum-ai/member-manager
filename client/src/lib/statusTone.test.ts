import { describe, expect, it } from "vitest";
import { statusTone } from "./statusTone";

describe("statusTone", () => {
	it("maps settled statuses to success", () => {
		expect(statusTone("approved")).toBe("success");
		expect(statusTone("completed")).toBe("success");
	});

	it("maps awaiting/in-flight statuses to warning/info", () => {
		expect(statusTone("pending")).toBe("warning");
		expect(statusTone("submitted")).toBe("info");
	});

	it("maps negative statuses to danger", () => {
		expect(statusTone("rejected")).toBe("danger");
		expect(statusTone("failed")).toBe("danger");
	});

	it("is case-insensitive", () => {
		expect(statusTone("Approved")).toBe("success");
		expect(statusTone("PENDING")).toBe("warning");
	});

	it("normalizes human-readable labels and surrounding whitespace", () => {
		expect(statusTone(" In review ")).toBe("info");
		expect(statusTone("not-approved")).toBe("danger");
		expect(statusTone("to be paid")).toBe("warning");
	});

	it("covers common inactive and queued states", () => {
		expect(statusTone("alumni")).toBe("neutral");
		expect(statusTone("inactive")).toBe("neutral");
		expect(statusTone("queued")).toBe("info");
	});

	it("falls back to neutral for unknown statuses", () => {
		expect(statusTone("something_else")).toBe("neutral");
		expect(statusTone("")).toBe("neutral");
	});
});
