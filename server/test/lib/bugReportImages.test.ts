import "../setup.js";
import assert from "node:assert";
import { afterEach, test } from "node:test";
import {
	decodeBugReportImage,
	detectBugReportImageType,
	MAX_BUG_REPORT_IMAGE_BYTES,
	resetBugReportImageUploader,
	setBugReportImageUploader,
	uploadBugReportImage,
} from "../../src/lib/bugReportImages.js";
import { ValidationError } from "../../src/lib/errors.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = Buffer.from("GIF89a", "latin1");
const WEBP = Buffer.concat([
	Buffer.from("RIFF", "latin1"),
	Buffer.from([0x00, 0x00, 0x00, 0x00]),
	Buffer.from("WEBP", "latin1"),
]);

function toBase64(buffer: Buffer): string {
	return buffer.toString("base64");
}

afterEach(() => {
	resetBugReportImageUploader();
});

test("detectBugReportImageType recognises supported formats", () => {
	assert.deepStrictEqual(detectBugReportImageType(PNG), {
		contentType: "image/png",
		extension: "png",
	});
	assert.deepStrictEqual(detectBugReportImageType(JPEG), {
		contentType: "image/jpeg",
		extension: "jpg",
	});
	assert.deepStrictEqual(detectBugReportImageType(GIF), {
		contentType: "image/gif",
		extension: "gif",
	});
	assert.deepStrictEqual(detectBugReportImageType(WEBP), {
		contentType: "image/webp",
		extension: "webp",
	});
});

test("detectBugReportImageType returns null for non-images", () => {
	assert.strictEqual(detectBugReportImageType(Buffer.from("%PDF-1.7")), null);
	assert.strictEqual(detectBugReportImageType(Buffer.from("")), null);
});

test("decodeBugReportImage decodes a valid image and strips data URL prefix", () => {
	const plain = decodeBugReportImage(toBase64(PNG));
	assert.strictEqual(plain.contentType, "image/png");
	assert.strictEqual(plain.extension, "png");
	assert.ok(plain.buffer.equals(PNG));

	const withPrefix = decodeBugReportImage(
		`data:image/png;base64,${toBase64(PNG)}`,
	);
	assert.ok(withPrefix.buffer.equals(PNG));
});

test("decodeBugReportImage rejects empty input", () => {
	assert.throws(() => decodeBugReportImage(""), ValidationError);
});

test("decodeBugReportImage rejects non-image content", () => {
	assert.throws(
		() => decodeBugReportImage(toBase64(Buffer.from("%PDF-1.7 not an image"))),
		/PNG, JPEG, GIF, or WebP/,
	);
});

test("decodeBugReportImage rejects oversized images", () => {
	const tooBig = toBase64(Buffer.alloc(MAX_BUG_REPORT_IMAGE_BYTES + 1));
	assert.throws(() => decodeBugReportImage(tooBig), /too large/);
});

test("uploadBugReportImage delegates to the injected uploader", async () => {
	const seen: string[] = [];
	setBugReportImageUploader(async (image) => {
		seen.push(image.contentType);
		return "https://example.test/screenshot.png";
	});

	const url = await uploadBugReportImage({
		buffer: PNG,
		contentType: "image/png",
		extension: "png",
	});

	assert.strictEqual(url, "https://example.test/screenshot.png");
	assert.deepStrictEqual(seen, ["image/png"]);
});
