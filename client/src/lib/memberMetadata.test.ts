import { describe, expect, it } from "vitest";
import {
	buildMemberNameSearchText,
	extractLinkedinId,
	formatDegree,
	getEducationEntries,
	joinDegree,
	serializeEducationEntries,
	splitDegree,
} from "./memberMetadata";

describe("memberMetadata", () => {
	it("normalizes legacy Bachelor and Master abbreviations", () => {
		expect(splitDegree("B.Sc. Computer Science")).toEqual({
			type: "Bachelor",
			program: "Computer Science",
		});
		expect(splitDegree("B.A. Communication Science")).toEqual({
			type: "Bachelor",
			program: "Communication Science",
		});
		expect(splitDegree("M.Sc. Management & Technology")).toEqual({
			type: "Master",
			program: "Management & Technology",
		});
		expect(formatDegree("B.Sc. Computer Science")).toBe(
			"Bachelor Computer Science",
		);
	});

	it("supports Staatsexamen programs", () => {
		expect(splitDegree("Staatsexamen Medicine")).toEqual({
			type: "Staatsexamen",
			program: "Medicine",
		});
		expect(joinDegree("Staatsexamen", "Law")).toBe("Staatsexamen Law");
	});

	it("normalizes multiple current studies stored as newline-separated values", () => {
		expect(formatDegree("B.Sc. Computer Science\nM.Sc. Data Science")).toBe(
			"Bachelor Computer Science\nMaster Data Science",
		);
		expect(
			getEducationEntries(
				"B.Sc. Computer Science\nM.Sc. Data Science",
				"TUM\nLMU",
			),
		).toEqual([
			{ degree: "Bachelor Computer Science", school: "TUM" },
			{ degree: "Master Data Science", school: "LMU" },
		]);
		expect(
			serializeEducationEntries([
				{ degree: "B.Sc. Computer Science", school: "TUM" },
				{ degree: "Master Data Science", school: "LMU" },
			]),
		).toEqual({
			degree: "Bachelor Computer Science\nMaster Data Science",
			school: "TUM\nLMU",
		});
	});

	it("preserves row alignment when one education column is empty", () => {
		const serialized = serializeEducationEntries([
			{ degree: "", school: "TUM" },
			{ degree: "Master Data Science", school: "LMU" },
			{ degree: "PhD AI", school: "" },
		]);

		expect(serialized).toEqual({
			degree: "\nMaster Data Science\nPhD AI",
			school: "TUM\nLMU\n",
		});
		expect(getEducationEntries(serialized.degree, serialized.school)).toEqual([
			{ degree: "", school: "TUM" },
			{ degree: "Master Data Science", school: "LMU" },
			{ degree: "PhD AI", school: "" },
		]);
	});

	it("builds a bidirectional member-name search string", () => {
		expect(buildMemberNameSearchText("Ada", "Lovelace")).toBe(
			"Ada Lovelace Lovelace Ada",
		);
	});

	it("extracts LinkedIn profile IDs only from LinkedIn profile URLs", () => {
		expect(
			extractLinkedinId("https://www.linkedin.com/in/example-profile/"),
		).toBe("example-profile");
		expect(extractLinkedinId("https://example.com/in/example-profile")).toBe(
			"",
		);
	});
});
