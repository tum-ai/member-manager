import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import {
	fillContractDocx,
	inspectContractDocx,
	inspectFilledContractDocx,
} from "../../src/lib/contracts/contractDocx.js";
import { ValidationError } from "../../src/lib/errors.js";
import {
	CONTRACT_DOCX_FIXTURE_ANCHORS,
	createContractDocxFixture,
} from "../fixtures/contractDocxFixture.js";

const anchors = [...CONTRACT_DOCX_FIXTURE_ANCHORS];

describe("contract DOCX validation", () => {
	it("accepts only allowlisted variables and both unique anchors", async () => {
		const docx = await createContractDocxFixture([
			"{{company_name}}",
			...anchors,
		]);
		const manifest = await inspectContractDocx(
			docx,
			new Set(["company_name"]),
			new Set(["company_name"]),
		);
		assert.deepEqual(manifest.variables, ["company_name"]);
		assert.deepEqual(manifest.signatureAnchors, ["partner", "board"]);
	});

	it("rejects executable template commands", async () => {
		const docx = await createContractDocxFixture([
			"{{EXEC process.exit()}}",
			...anchors,
		]);
		await assert.rejects(() => inspectContractDocx(docx), {
			message: "DOCX contains a command outside the contract allowlist",
		});
	});

	it("rejects unmatched delimiters across Word text runs", async () => {
		const docx = await createContractDocxFixture([
			"{{company_name}",
			...anchors,
		]);
		await assert.rejects(() => inspectContractDocx(docx), {
			message: "DOCX contains nested or unmatched template delimiters",
		});
	});

	it("rejects active fields outside the main document part", async () => {
		const buffer = await createContractDocxFixture();
		const zip = await JSZip.loadAsync(buffer);
		zip.file(
			"word/header1.xml",
			'<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:instrText>MACROBUTTON AutoOpen</w:instrText></w:r></w:p></w:hdr>',
		);
		const unsafe = await zip.generateAsync({ type: "nodebuffer" });
		await assert.rejects(
			() => inspectContractDocx(unsafe),
			(error: unknown) =>
				error instanceof ValidationError &&
				error.details?.code === "DOCX_ACTIVE_CONTENT_FORBIDDEN",
		);
	});

	it("allows hyperlinks and embedded media", async () => {
		const buffer = await createContractDocxFixture();
		const zip = await JSZip.loadAsync(buffer);
		zip.file(
			"word/_rels/document.xml.rels",
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/legal" TargetMode="External"/></Relationships>',
		);
		zip.file("word/media/image1.png", Buffer.from("embedded image"));
		const safe = await zip.generateAsync({ type: "nodebuffer" });
		const manifest = await inspectContractDocx(safe);
		assert.deepEqual(manifest.signatureAnchors, ["partner", "board"]);
	});

	it("rejects OLE objects and unsafe external relationships", async () => {
		const buffer = await createContractDocxFixture();
		const zip = await JSZip.loadAsync(buffer);
		zip.file(
			"word/_rels/document.xml.rels",
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="file:///tmp/contract" TargetMode="External"/></Relationships>',
		);
		zip.file("word/embeddings/oleObject1.bin", Buffer.from("OLE object"));
		const unsafe = await zip.generateAsync({ type: "nodebuffer" });
		await assert.rejects(
			() => inspectContractDocx(unsafe),
			(error: unknown) =>
				error instanceof ValidationError &&
				error.details?.code === "DOCX_ACTIVE_CONTENT_FORBIDDEN",
		);

		const relationshipOnly = await createContractDocxFixture();
		const relationshipZip = await JSZip.loadAsync(relationshipOnly);
		relationshipZip.file(
			"word/_rels/document.xml.rels",
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="file:///tmp/contract" TargetMode="External"/></Relationships>',
		);
		const unsafeRelationship = await relationshipZip.generateAsync({
			type: "nodebuffer",
		});
		await assert.rejects(
			() => inspectContractDocx(unsafeRelationship),
			(error: unknown) =>
				error instanceof ValidationError &&
				error.details?.code === "DOCX_EXTERNAL_RELATIONSHIP_FORBIDDEN",
		);
	});

	it("allows harmless Word fields such as page numbers", async () => {
		const buffer = await createContractDocxFixture();
		const zip = await JSZip.loadAsync(buffer);
		zip.file(
			"word/header1.xml",
			'<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:fldChar w:fldCharType="begin"/><w:instrText> PAGE </w:instrText><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>',
		);
		const safe = await zip.generateAsync({ type: "nodebuffer" });
		const manifest = await inspectContractDocx(safe);
		assert.deepEqual(manifest.signatureAnchors, ["partner", "board"]);
	});

	it("does not mistake Word style links for active fields", async () => {
		const buffer = await createContractDocxFixture();
		const zip = await JSZip.loadAsync(buffer);
		zip.file(
			"word/styles.xml",
			'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph"><w:link w:val="HeaderChar"/></w:style></w:styles>',
		);
		const safe = await zip.generateAsync({ type: "nodebuffer" });
		const manifest = await inspectContractDocx(safe);
		assert.deepEqual(manifest.signatureAnchors, ["partner", "board"]);

		zip.file(
			"word/header1.xml",
			'<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:fldSimple w:instr=" INCLUDEPICTURE &quot;https://example.test/tracker&quot; "/></w:p></w:hdr>',
		);
		const unsafe = await zip.generateAsync({ type: "nodebuffer" });
		await assert.rejects(
			() => inspectContractDocx(unsafe),
			(error: unknown) =>
				error instanceof ValidationError &&
				error.details?.code === "DOCX_ACTIVE_CONTENT_FORBIDDEN",
		);
	});

	it("rejects required variables missing from the DOCX", async () => {
		const docx = await createContractDocxFixture(anchors);
		await assert.rejects(
			() =>
				inspectContractDocx(
					docx,
					new Set(["company_name"]),
					new Set(["company_name"]),
				),
			{ message: "DOCX does not use required variables: company_name" },
		);
	});

	it("fills values and leaves exactly one relationship for each sentinel", async () => {
		const template = await createContractDocxFixture([
			"{{company_name}}",
			...anchors,
		]);
		const result = await fillContractDocx({
			template,
			formData: { company_name: "Acme & Partners" },
			allowedVariableNames: new Set(["company_name"]),
			requiredVariableNames: new Set(["company_name"]),
		});
		const manifest = await inspectFilledContractDocx(result.docx);
		assert.deepEqual(manifest.signatureAnchors, ["partner", "board"]);
		const zip = await JSZip.loadAsync(result.docx);
		const xml = await zip.file("word/document.xml")?.async("string");
		assert.match(xml ?? "", /Acme &amp; Partners/);
	});

	it("does not treat form values as literal OOXML", async () => {
		const template = await createContractDocxFixture([
			"{{company_name}}",
			...anchors,
		]);
		const result = await fillContractDocx({
			template,
			formData: { company_name: "||<w:t>injected</w:t>||" },
			allowedVariableNames: new Set(["company_name"]),
		});
		const xml = await (await JSZip.loadAsync(result.docx))
			.file("word/document.xml")
			?.async("string");
		assert.doesNotMatch(xml ?? "", /<w:t>injected<\/w:t>/);
		assert.match(xml ?? "", /&lt;w:t&gt;injected&lt;\/w:t&gt;/);
	});

	it("renders deterministic DOCX bytes for immutable retry paths", async () => {
		const template = await createContractDocxFixture([
			"{{company_name}}",
			...anchors,
		]);
		const input = {
			template,
			formData: { company_name: "Deterministic GmbH" },
			allowedVariableNames: new Set(["company_name"]),
		};
		const first = await fillContractDocx(input);
		const second = await fillContractDocx(input);
		assert.deepEqual(first.docx, second.docx);
	});

	it("rejects duplicate signature anchor commands", async () => {
		const docx = await createContractDocxFixture([
			anchors[0] ?? "",
			...anchors,
		]);
		await assert.rejects(() => inspectContractDocx(docx), {
			message:
				"DOCX must contain exactly one partner and one board signature anchor",
		});
	});
});
