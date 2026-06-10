import { describe, expect, it } from "vitest";
import {
	getResearchProjectFallbackTitle,
	getResearchProjectSelectValue,
	isInternalResearchProjectReference,
} from "./researchProjects";

describe("getResearchProjectSelectValue", () => {
	it("maps saved aliases to the current project id", () => {
		expect(
			getResearchProjectSelectValue("ibm-almaden-sycophancy-in-lms", [
				{
					id: "N4SbQ8230skgGtiVXbeqGg",
					title: "IBM Almaden: Sycophancy in LMs",
					aliases: ["N4SbQ8230skgGtiVXbeqGg", "ibm-almaden-sycophancy-in-lms"],
				},
			]),
		).toBe("N4SbQ8230skgGtiVXbeqGg");
	});

	it("keeps unknown saved values so the form does not silently rewrite them", () => {
		expect(
			getResearchProjectSelectValue("legacy-notion-project", [
				{
					id: "N4SbQ8230skgGtiVXbeqGg",
					title: "IBM Almaden: Sycophancy in LMs",
					aliases: ["ibm-almaden-sycophancy-in-lms"],
				},
			]),
		).toBe("legacy-notion-project");
	});

	it("detects opaque internal references", () => {
		expect(
			isInternalResearchProjectReference(
				"29b7306b-fd62-805d-8e47-fbe49a5443d4",
			),
		).toBe(true);
		expect(isInternalResearchProjectReference("N4SbQ8230skgGtiVXbeqeg")).toBe(
			true,
		);
		expect(isInternalResearchProjectReference("legacy-project-slug")).toBe(
			false,
		);
	});

	it("uses a generic title for unmatched internal references", () => {
		expect(
			getResearchProjectFallbackTitle("29b7306b-fd62-805d-8e47-fbe49a5443d4"),
		).toBe("Unmatched Research Project");
		expect(getResearchProjectFallbackTitle("Legacy Project Name")).toBe(
			"Legacy Project Name",
		);
	});
});
