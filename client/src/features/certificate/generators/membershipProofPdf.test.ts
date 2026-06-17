import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BOARD_MEMBERS } from "@/lib/pdfUtils";
import type { Member } from "@/types";
import { generateMembershipProofPdf } from "./membershipProofPdf";

type MockDoc = {
	text: ReturnType<typeof vi.fn>;
	splitTextToSize: ReturnType<typeof vi.fn>;
	output: ReturnType<typeof vi.fn>;
};

const { jsPDFMock, lastInstance } = vi.hoisted(() => {
	const ref: { current: MockDoc | null } = { current: null };
	const mock = vi.fn(function jsPDF() {
		const instance = {
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
				pageSize: { getWidth: () => 210, getHeight: () => 297 },
			},
		};
		ref.current = instance;
		return instance;
	});
	return { jsPDFMock: mock, lastInstance: ref };
});

vi.mock("jspdf", () => ({ jsPDF: jsPDFMock }));

const { addLogoToDocument } = vi.hoisted(() => ({
	addLogoToDocument: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));

vi.mock("@/lib/pdfUtils", async (importActual) => {
	const actual = await importActual<typeof import("@/lib/pdfUtils")>();
	return {
		...actual,
		addLogoToDocument,
		loadImageAsBase64: vi.fn(() => Promise.resolve("data:image/png;base64,x")),
	};
});

const member: Member = {
	active: true,
	salutation: "Ms.",
	title: "",
	surname: "Lovelace",
	given_name: "Ada",
	email: "ada@example.com",
	date_of_birth: "1990-01-01",
	street: "Main",
	number: "1",
	postal_code: "80333",
	city: "Munich",
	country: "Germany",
	user_id: "user-1",
};

beforeEach(() => {
	vi.clearAllMocks();
	lastInstance.current = null;
});

describe("generateMembershipProofPdf", () => {
	it("returns a PDF Blob with default board members", async () => {
		const blob = await generateMembershipProofPdf(member);

		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("application/pdf");
		expect(addLogoToDocument).toHaveBeenCalledTimes(1);

		const textArgs = vi
			.mocked(lastInstance.current?.text ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(textArgs).toContain(DEFAULT_BOARD_MEMBERS.president.name);
		expect(textArgs).toContain(DEFAULT_BOARD_MEMBERS.vicePresident.name);
		expect(textArgs).toContain("Ms. Ada Lovelace");
	});

	it("renders the member name without a salutation when none is set", async () => {
		const blob = await generateMembershipProofPdf({
			...member,
			salutation: "",
		});

		expect(blob).toBeInstanceOf(Blob);
		const textArgs = vi
			.mocked(lastInstance.current?.text ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(textArgs).toContain("Ada Lovelace");
	});

	it("uses custom board members from options", async () => {
		await generateMembershipProofPdf(member, {
			president: { name: "Custom President", title: "President" },
			vicePresident: { name: "Custom VP", title: "Vice President" },
		});

		const textArgs = vi
			.mocked(lastInstance.current?.text ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(textArgs).toContain("Custom President");
		expect(textArgs).toContain("Custom VP");
		expect(textArgs).not.toContain(DEFAULT_BOARD_MEMBERS.president.name);
	});
});
