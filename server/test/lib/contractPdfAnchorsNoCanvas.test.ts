import assert from "node:assert/strict";
import Module from "node:module";
import { after, before, describe, it } from "node:test";

/**
 * The deployed function never contains `@napi-rs/canvas`: pdf.js loads that
 * optional dependency through a platform-conditional `require()` that Vercel
 * file tracing cannot follow. A dev machine has it installed, so every other
 * test exercises a pdf.js that found it — which is exactly how the production
 * failure "DOMMatrix is not defined" shipped with a green suite.
 *
 * This file makes the package unresolvable before pdf.js is imported, so it
 * asserts the same conditions the function runs under. It lives on its own
 * because the node test runner gives each file a fresh process, and pdf.js can
 * only be loaded once per process.
 */
const originalLoad = Module._load;
const originalMode = process.env.CONTRACT_DOCX_CONVERTER_MODE;
const originalNodeEnv = process.env.NODE_ENV;

describe("contract PDF signature anchors without @napi-rs/canvas", () => {
	before(() => {
		process.env.NODE_ENV = "test";
		process.env.CONTRACT_DOCX_CONVERTER_MODE = "fake";
		Module._load = function blockCanvas(request: string, ...rest: unknown[]) {
			if (request === "@napi-rs/canvas") {
				throw new Error("Cannot find module '@napi-rs/canvas'");
			}
			return (
				originalLoad as (request: string, ...rest: unknown[]) => unknown
			).call(this, request, ...rest);
		} as typeof Module._load;
	});

	after(() => {
		Module._load = originalLoad;
		if (originalMode === undefined) {
			delete process.env.CONTRACT_DOCX_CONVERTER_MODE;
		} else {
			process.env.CONTRACT_DOCX_CONVERTER_MODE = originalMode;
		}
		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = originalNodeEnv;
	});

	it("still locates both anchors when the native canvas is unavailable", async () => {
		const { convertContractDocxToPdf } = await import(
			"../../src/lib/contracts/contractConverter.js"
		);
		const { findContractPdfSignatureAnchors } = await import(
			"../../src/lib/contracts/contractPdfAnchors.js"
		);
		const { DomMatrix } = await import("../../src/lib/contracts/domMatrix.js");

		const pdf = await convertContractDocxToPdf(Buffer.from("fake DOCX"));
		const anchors = await findContractPdfSignatureAnchors(pdf);

		// Same expectations as the canvas-backed run in contractPdfAnchors.test.ts:
		// the polyfill must not move an anchor.
		assert.equal(anchors.partner.page, 1);
		assert.equal(anchors.board.page, 1);
		assert.ok(anchors.partner.width > 0);
		assert.ok(anchors.board.height > 0);
		// Proves the polyfill is what satisfied pdf.js, rather than a DOMMatrix
		// that arrived from somewhere else and made the block ineffective.
		assert.equal(globalThis.DOMMatrix, DomMatrix);
	});
});
