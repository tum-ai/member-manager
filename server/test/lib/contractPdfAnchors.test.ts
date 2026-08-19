import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { convertContractDocxToPdf } from "../../src/lib/contracts/contractConverter.js";
import { CONTRACT_SIGNATURE_SENTINELS } from "../../src/lib/contracts/contractDocx.js";
import {
	decodeContractSignatureDataUrl,
	findContractPdfSignatureAnchors,
	stampContractPdfSignature,
} from "../../src/lib/contracts/contractPdfAnchors.js";

const originalMode = process.env.CONTRACT_DOCX_CONVERTER_MODE;
const originalNodeEnv = process.env.NODE_ENV;
const SIGNATURE_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZsusAAAAASUVORK5CYII=";

describe("contract PDF signature anchors", () => {
	beforeEach(() => {
		process.env.NODE_ENV = "test";
		process.env.CONTRACT_DOCX_CONVERTER_MODE = "fake";
	});

	afterEach(() => {
		if (originalMode === undefined) {
			delete process.env.CONTRACT_DOCX_CONVERTER_MODE;
		} else {
			process.env.CONTRACT_DOCX_CONVERTER_MODE = originalMode;
		}
		if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = originalNodeEnv;
	});

	it("locates exactly one partner and board anchor in fake output", async () => {
		const pdf = await convertContractDocxToPdf(Buffer.from("fake DOCX"));
		const anchors = await findContractPdfSignatureAnchors(pdf);
		assert.equal(anchors.partner.page, 1);
		assert.equal(anchors.board.page, 1);
		assert.ok(anchors.partner.width > 0);
		assert.ok(anchors.board.height > 0);
	});

	it("stamps a trusted stored anchor when provider output has no sentinels", async () => {
		const source = await convertContractDocxToPdf(Buffer.from("fake DOCX"));
		const anchor = (await findContractPdfSignatureAnchors(source)).partner;
		const providerPdf = await PDFDocument.create();
		providerPdf.addPage([595, 842]);
		const result = await stampContractPdfSignature({
			pdf: Buffer.from(await providerPdf.save()),
			signaturePng: decodeContractSignatureDataUrl(SIGNATURE_DATA_URL),
			role: "partner",
			trustedAnchor: anchor,
		});
		assert.match(result.pdf.subarray(0, 5).toString("ascii"), /^%PDF-/);
		assert.deepEqual(result.anchor, anchor);
	});

	it("rejects a trusted stored anchor outside the provider page", async () => {
		const providerPdf = await PDFDocument.create();
		providerPdf.addPage([595, 842]);
		const providerBytes = Buffer.from(await providerPdf.save());
		await assert.rejects(() =>
			stampContractPdfSignature({
				pdf: providerBytes,
				signaturePng: decodeContractSignatureDataUrl(SIGNATURE_DATA_URL),
				role: "board",
				trustedAnchor: {
					page: 1,
					x: 590,
					y: 100,
					width: 30,
					height: 20,
				},
			}),
		);
	});

	it("rejects duplicate partner anchor placement", async () => {
		const source = await convertContractDocxToPdf(Buffer.from("fake DOCX"));
		const document = await PDFDocument.load(source);
		const duplicate = await document.embedPng(
			CONTRACT_SIGNATURE_SENTINELS.partner.png,
		);
		document.getPage(0).drawImage(duplicate, {
			x: 72,
			y: 400,
			width: 168,
			height: 60,
		});
		const duplicatePdf = Buffer.from(await document.save());
		await assert.rejects(() => findContractPdfSignatureAnchors(duplicatePdf));
	});
});
