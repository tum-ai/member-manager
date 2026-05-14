import { describe, expect, it } from "vitest";
import {
	buildMemberNameSearchText,
	formatDegree,
	joinDegree,
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

	it("builds a bidirectional member-name search string", () => {
		expect(buildMemberNameSearchText("Ada", "Lovelace")).toBe(
			"Ada Lovelace Lovelace Ada",
		);
	});
});
