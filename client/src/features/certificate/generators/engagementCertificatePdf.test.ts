import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngagementSchema } from "@/lib/schemas";
import type { Member } from "@/types";
import { generateEngagementCertificatePdf } from "./engagementCertificatePdf";

type MockDoc = {
	text: ReturnType<typeof vi.fn>;
	splitTextToSize: ReturnType<typeof vi.fn>;
	addPage: ReturnType<typeof vi.fn>;
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
	salutation: "Mr.",
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

function makeEngagement(
	overrides: Partial<EngagementSchema> = {},
): EngagementSchema {
	return {
		id: "e1",
		startDate: "2024-01-01",
		endDate: "2024-06-30",
		isStillActive: false,
		weeklyHours: "10",
		department: "Software Development",
		isTeamLead: false,
		specialRole: "",
		tasksDescription: "Built tooling",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	lastInstance.current = null;
});

describe("generateEngagementCertificatePdf", () => {
	it("returns a PDF Blob and loads the logo", async () => {
		const blob = await generateEngagementCertificatePdf(member, [
			makeEngagement(),
		]);

		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("application/pdf");
		expect(addLogoToDocument).toHaveBeenCalledTimes(1);
	});

	it("handles an empty engagements array", async () => {
		const blob = await generateEngagementCertificatePdf(member, []);
		expect(blob).toBeInstanceOf(Blob);
	});

	it("renders role labels for team leads and special roles", async () => {
		await generateEngagementCertificatePdf(member, [
			makeEngagement({ isTeamLead: true, specialRole: "Vice-President" }),
		]);

		const doc = lastInstance.current;
		expect(doc).not.toBeNull();
		const splitArgs = vi
			.mocked(doc?.splitTextToSize ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(
			splitArgs.some(
				(arg) =>
					typeof arg === "string" &&
					arg.includes("Team Lead") &&
					arg.includes("Vice-President"),
			),
		).toBe(true);
	});

	it("omits role labels when neither team lead nor special role is set", async () => {
		await generateEngagementCertificatePdf(member, [
			makeEngagement({ isTeamLead: false, specialRole: "" }),
		]);

		const doc = lastInstance.current;
		const splitArgs = vi
			.mocked(doc?.splitTextToSize ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(
			splitArgs.some(
				(arg) =>
					typeof arg === "string" &&
					arg.includes("Software Development") &&
					!arg.includes("("),
			),
		).toBe(true);
	});

	it("renders 'Present' for still-active engagements", async () => {
		await generateEngagementCertificatePdf(member, [
			makeEngagement({ isStillActive: true, endDate: "" }),
		]);

		const doc = lastInstance.current;
		const splitArgs = vi
			.mocked(doc?.splitTextToSize ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(
			splitArgs.some(
				(arg) => typeof arg === "string" && arg.includes("Present"),
			),
		).toBe(true);
	});

	it("paginates when there are many engagements", async () => {
		// splitTextToSize returns one line per call; ~40 rows overflow one page.
		const many = Array.from({ length: 40 }, (_, i) =>
			makeEngagement({ id: `e${i}`, tasksDescription: `Task ${i}` }),
		);

		const blob = await generateEngagementCertificatePdf(member, many);

		expect(blob).toBeInstanceOf(Blob);
		expect(lastInstance.current?.addPage).toHaveBeenCalled();
	});

	it("uses custom board members in the signature block", async () => {
		await generateEngagementCertificatePdf(member, [makeEngagement()], {
			president: { name: "Custom President", title: "President" },
			vicePresident: { name: "Custom VP", title: "Vice President" },
		});

		const doc = lastInstance.current;
		const textArgs = vi
			.mocked(doc?.text ?? vi.fn())
			.mock.calls.map((call) => call[0]);
		expect(textArgs).toContain("Custom President");
		expect(textArgs).toContain("Custom VP");
	});
});
