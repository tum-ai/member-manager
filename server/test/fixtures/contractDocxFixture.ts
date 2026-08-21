import JSZip from "jszip";
import {
	BOARD_SIGNATURE_ANCHOR,
	PARTNER_SIGNATURE_ANCHOR,
} from "../../src/lib/contracts/contractDocx.js";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function documentXml(commands: string[]): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${commands
		.map(
			(command) =>
				`<w:p><w:r><w:t xml:space="preserve">${escapeXml(command)}</w:t></w:r></w:p>`,
		)
		.join("")}<w:sectPr/></w:body></w:document>`;
}

export const CONTRACT_DOCX_FIXTURE_ANCHORS = [
	`{{IMAGE ${PARTNER_SIGNATURE_ANCHOR}}}`,
	`{{IMAGE ${BOARD_SIGNATURE_ANCHOR}}}`,
] as const;

export async function createContractDocxFixture(
	commands: string[] = ["{{company_name}}", ...CONTRACT_DOCX_FIXTURE_ANCHORS],
): Promise<Buffer> {
	const zip = new JSZip();
	zip.file("[Content_Types].xml", CONTENT_TYPES);
	zip.file(
		"_rels/.rels",
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
	);
	zip.file("word/document.xml", documentXml(commands));
	zip.file(
		"word/_rels/document.xml.rels",
		`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
	);
	return zip.generateAsync({
		type: "nodebuffer",
		compression: "DEFLATE",
		compressionOptions: { level: 6 },
	});
}
