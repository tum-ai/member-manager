import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getContractConverterVersion } from "../../src/lib/contracts/contractConverter.js";

const originalMode = process.env.CONTRACT_DOCX_CONVERTER_MODE;
const originalImage = process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE;

afterEach(() => {
	if (originalMode === undefined)
		delete process.env.CONTRACT_DOCX_CONVERTER_MODE;
	else process.env.CONTRACT_DOCX_CONVERTER_MODE = originalMode;
	if (originalImage === undefined)
		delete process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE;
	else process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE = originalImage;
});

describe("contract converter image configuration", () => {
	it("rejects a VCR image that combines a tag and digest", () => {
		process.env.CONTRACT_DOCX_CONVERTER_MODE = "sandbox";
		process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE = `vcr.vercel.com/team/project/image:version@sha256:${"a".repeat(64)}`;

		assert.throws(
			() => getContractConverterVersion(),
			/immutable digest without a tag/,
		);
	});

	it("accepts a digest-only VCR image", () => {
		process.env.CONTRACT_DOCX_CONVERTER_MODE = "sandbox";
		const image = `vcr.vercel.com/team/project/image@sha256:${"a".repeat(64)}`;
		process.env.CONTRACT_LIBREOFFICE_SANDBOX_IMAGE = image;

		assert.equal(getContractConverterVersion(), image);
	});
});
