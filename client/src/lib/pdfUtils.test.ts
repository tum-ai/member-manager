import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { jsPDFInstances, jsPDFMock } = vi.hoisted(() => {
	type Instance = {
		setFont: ReturnType<typeof vi.fn>;
		setFontSize: ReturnType<typeof vi.fn>;
		setTextColor: ReturnType<typeof vi.fn>;
		setLineHeightFactor: ReturnType<typeof vi.fn>;
		text: ReturnType<typeof vi.fn>;
		splitTextToSize: ReturnType<typeof vi.fn>;
		addImage: ReturnType<typeof vi.fn>;
		addPage: ReturnType<typeof vi.fn>;
		output: ReturnType<typeof vi.fn>;
		internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
		orientation: string;
	};
	const instances: Instance[] = [];
	const mock = vi.fn(function jsPDF(orientation = "p") {
		const portrait = orientation === "p";
		const instance: Instance = {
			setFont: vi.fn(),
			setFontSize: vi.fn(),
			setTextColor: vi.fn(),
			setLineHeightFactor: vi.fn(),
			text: vi.fn(),
			splitTextToSize: vi.fn((text: string) => [text]),
			addImage: vi.fn(),
			addPage: vi.fn(),
			output: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
			internal: {
				pageSize: {
					getWidth: () => (portrait ? 210 : 297),
					getHeight: () => (portrait ? 297 : 210),
				},
			},
			orientation,
		};
		instances.push(instance);
		return instance;
	});
	return { jsPDFInstances: instances, jsPDFMock: mock };
});

vi.mock("jspdf", () => ({ jsPDF: jsPDFMock }));

import {
	addSignatureBlock,
	createPdfDocument,
	DEFAULT_BOARD_MEMBERS,
	downloadPdfBlob,
	formatGermanDate,
	getTodayGermanDate,
} from "./pdfUtils";

beforeEach(() => {
	jsPDFInstances.length = 0;
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("formatGermanDate", () => {
	it("formats a valid ISO date in German long form", () => {
		expect(formatGermanDate("2025-01-01")).toBe("1. Januar 2025");
	});

	it.each([
		null,
		undefined,
		"",
		"   ",
		"not-a-date",
	])("returns 'Not provided' for %s", (value) => {
		expect(formatGermanDate(value as string | null | undefined)).toBe(
			"Not provided",
		);
	});
});

describe("getTodayGermanDate", () => {
	it("returns a non-empty German-formatted string", () => {
		const result = getTodayGermanDate();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		// German long-form dates end in a 4-digit year.
		expect(result).toMatch(/\d{4}$/);
	});
});

describe("createPdfDocument", () => {
	it("uses portrait defaults", () => {
		const result = createPdfDocument();

		expect(jsPDFMock).toHaveBeenCalledWith("p", "mm", "a4");
		expect(result.pageWidth).toBe(210);
		expect(result.pageHeight).toBe(297);
		expect(result.margin).toBe(20);
		expect(result.maxWidth).toBe(210 - 20 * 2);
	});

	it("honors orientation and margin options", () => {
		const result = createPdfDocument({ orientation: "l", margin: 10 });

		expect(jsPDFMock).toHaveBeenCalledWith("l", "mm", "a4");
		expect(result.pageWidth).toBe(297);
		expect(result.pageHeight).toBe(210);
		expect(result.margin).toBe(10);
		expect(result.maxWidth).toBe(297 - 10 * 2);
	});
});

describe("addSignatureBlock", () => {
	it("renders default board members with today's date", () => {
		const { doc, pageWidth, margin } = createPdfDocument();

		addSignatureBlock(doc, 100, margin, pageWidth);

		expect(doc.text).toHaveBeenCalledWith(
			DEFAULT_BOARD_MEMBERS.vicePresident.name,
			margin,
			100,
		);
		expect(doc.text).toHaveBeenCalledWith(
			DEFAULT_BOARD_MEMBERS.president.name,
			pageWidth - margin - 60,
			100,
		);
		const today = getTodayGermanDate();
		expect(doc.text).toHaveBeenCalledWith(`Munich, ${today}`, margin, 112);
	});

	it("renders custom board members and date", () => {
		const { doc, pageWidth, margin } = createPdfDocument();

		addSignatureBlock(doc, 100, margin, pageWidth, {
			president: { name: "Alice", title: "President" },
			vicePresident: { name: "Bob", title: "Vice President" },
			date: "1. Januar 2025",
		});

		expect(doc.text).toHaveBeenCalledWith("Bob", margin, 100);
		expect(doc.text).toHaveBeenCalledWith("Vice President", margin, 106);
		expect(doc.text).toHaveBeenCalledWith(
			"Alice",
			pageWidth - margin - 60,
			100,
		);
		expect(doc.text).toHaveBeenCalledWith(
			"Munich, 1. Januar 2025",
			margin,
			112,
		);
	});
});

/**
 * Stubs the global `Image` so `loadImageAsBase64` resolves (onload) or rejects
 * (onerror) deterministically without a real network/canvas. `loadImageAsBase64`
 * caches by `src`, so each test uses a unique `src` to avoid cache bleed.
 */
function stubImage(behavior: "load" | "error") {
	class FakeImage {
		crossOrigin = "";
		width = 10;
		height = 10;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		set src(_value: string) {
			queueMicrotask(() => {
				if (behavior === "load") this.onload?.();
				else this.onerror?.();
			});
		}
	}
	vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
}

describe("addLogoToDocument", () => {
	// `loadImageAsBase64` caches by `src` at module scope, so re-import a fresh
	// module per test to keep the success/error paths independent.
	beforeEach(() => {
		vi.resetModules();
	});

	it("adds the loaded logo image to the document", async () => {
		stubImage("load");
		vi.spyOn(document, "createElement").mockReturnValueOnce({
			width: 0,
			height: 0,
			getContext: () => ({ drawImage: vi.fn() }),
			toDataURL: () => "data:image/png;base64,x",
		} as unknown as HTMLCanvasElement);
		const utils = await import("./pdfUtils");
		const { doc, pageWidth } = utils.createPdfDocument();

		await utils.addLogoToDocument(doc, pageWidth);

		expect(doc.addImage).toHaveBeenCalledTimes(1);
		const call = vi.mocked(doc.addImage).mock.calls[0] as unknown[];
		expect(call[0]).toBe("data:image/png;base64,x");
		expect(call[1]).toBe("PNG");
	});

	it("swallows load errors without throwing or adding an image", async () => {
		stubImage("error");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const utils = await import("./pdfUtils");
		const { doc, pageWidth } = utils.createPdfDocument();

		await expect(
			utils.addLogoToDocument(doc, pageWidth),
		).resolves.toBeUndefined();
		expect(doc.addImage).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalled();
	});
});

describe("downloadPdfBlob", () => {
	const createObjectURL = vi.fn(() => "blob:fake-url");
	const revokeObjectURL = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
		createObjectURL.mockClear();
		revokeObjectURL.mockClear();
		vi.stubGlobal("URL", {
			createObjectURL,
			revokeObjectURL,
		} as unknown as typeof URL);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function stubUserAgent(userAgent: string, maxTouchPoints = 0) {
		vi.stubGlobal("navigator", {
			userAgent,
			maxTouchPoints,
		} as unknown as Navigator);
	}

	it("downloads via an anchor on desktop", () => {
		stubUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
		const anchor = document.createElement("a");
		const click = vi.spyOn(anchor, "click").mockImplementation(() => {});
		vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);
		const append = vi.spyOn(document.body, "appendChild");
		const remove = vi.spyOn(document.body, "removeChild");

		downloadPdfBlob(new Blob(["pdf"]), "file.pdf");

		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(anchor.getAttribute("href")).toBe("blob:fake-url");
		expect(anchor.download).toBe("file.pdf");
		expect(click).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(anchor);
		expect(remove).toHaveBeenCalledWith(anchor);

		vi.runAllTimers();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
	});

	it("opens a new tab on mobile devices", () => {
		stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
		const open = vi.fn(() => ({}) as Window);
		vi.stubGlobal("open", open);

		downloadPdfBlob(new Blob(["pdf"]), "file.pdf");

		expect(open).toHaveBeenCalledWith("blob:fake-url", "_blank");

		vi.runAllTimers();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
	});

	it("treats touch-capable Macs (iPadOS) as mobile", () => {
		stubUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5);
		const open = vi.fn(() => ({}) as Window);
		vi.stubGlobal("open", open);

		downloadPdfBlob(new Blob(["pdf"]), "file.pdf");

		expect(open).toHaveBeenCalledWith("blob:fake-url", "_blank");
	});

	it("falls back to an anchor when the popup is blocked on mobile", () => {
		stubUserAgent("Mozilla/5.0 (Android 14; Mobile)");
		const open = vi.fn(() => null);
		vi.stubGlobal("open", open);
		const anchor = document.createElement("a");
		const click = vi.spyOn(anchor, "click").mockImplementation(() => {});
		vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);
		const append = vi.spyOn(document.body, "appendChild");
		const remove = vi.spyOn(document.body, "removeChild");

		downloadPdfBlob(new Blob(["pdf"]), "file.pdf");

		expect(open).toHaveBeenCalledTimes(1);
		expect(anchor.getAttribute("href")).toBe("blob:fake-url");
		expect(anchor.target).toBe("_blank");
		expect(click).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(anchor);
		expect(remove).toHaveBeenCalledWith(anchor);
	});
});
