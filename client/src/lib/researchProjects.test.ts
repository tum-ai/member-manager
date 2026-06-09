import { describe, expect, it } from "vitest";
import { getResearchProjectSelectValue } from "./researchProjects";

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
});
