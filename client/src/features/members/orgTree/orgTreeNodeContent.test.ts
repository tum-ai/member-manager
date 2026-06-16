import { describe, expect, it } from "vitest";
import type { Member } from "../../../types";
import type { OrgTreeNode } from "./orgTreeData";
import {
	escapeHtml,
	getNodeSize,
	renderButtonContent,
	renderNodeContent,
} from "./orgTreeNodeContent";

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Doe",
		given_name: "Jane",
		email: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		user_id: crypto.randomUUID(),
		member_status: "active",
		...overrides,
	};
}

describe("escapeHtml", () => {
	it("escapes angle brackets, ampersands, and quotes", () => {
		expect(escapeHtml(`<img src="x" onerror='a'>&`)).toBe(
			"&lt;img src=&quot;x&quot; onerror=&#39;a&#39;&gt;&amp;",
		);
	});
});

describe("renderNodeContent", () => {
	it("renders a co-lead avatar per lead with their names", () => {
		const node: OrgTreeNode = {
			id: "dept:Marketing",
			kind: "department",
			title: "Marketing",
			roleLabel: "Department",
			accent: true,
			memberCount: 2,
			leads: [
				buildMember({ given_name: "Anna", surname: "Beck" }),
				buildMember({ given_name: "Carl", surname: "Diaz" }),
			],
		};
		const html = renderNodeContent(node);
		expect(html).toContain("Marketing");
		expect(html).toContain("Anna Beck");
		expect(html).toContain("Carl Diaz");
		// One avatar wrapper per co-lead (initials fallback divs).
		expect(html.match(/border-radius:9999px/g)?.length).toBeGreaterThanOrEqual(
			2,
		);
	});

	it("escapes member names to prevent HTML injection", () => {
		const node: OrgTreeNode = {
			id: "member:x",
			kind: "person",
			roleLabel: "Marketing",
			member: buildMember({ given_name: "<script>", surname: "& Co" }),
		};
		const html = renderNodeContent(node);
		expect(html).toContain("&lt;script&gt; &amp; Co");
		expect(html).not.toContain("<script>");
	});

	it("renders the board card with every seat's name and role", () => {
		const html = renderNodeContent({
			id: "board",
			kind: "board",
			title: "Executive Board",
			memberCount: 2,
			board: [
				{
					member: buildMember({ given_name: "Ada", surname: "P" }),
					role: "President",
				},
				{
					member: buildMember({ given_name: "Vera", surname: "V" }),
					role: "Vice-President",
				},
			],
		});
		expect(html).toContain("Executive Board");
		expect(html).toContain("Ada P");
		expect(html).toContain("President");
		expect(html).toContain("Vera V");
		expect(html).toContain("2 members");
	});
});

describe("renderButtonContent", () => {
	it("shows the subordinate count", () => {
		const html = renderButtonContent({
			node: { children: undefined, data: { _directSubordinatesPaging: 5 } },
		});
		expect(html).toContain("5");
	});
});

describe("getNodeSize", () => {
	it("widens leadership nodes to fit more co-leads", () => {
		const one = getNodeSize({ id: "a", kind: "department", leads: [] });
		const three = getNodeSize({
			id: "b",
			kind: "department",
			leads: [{}, {}, {}] as never,
		});
		expect(three.width).toBeGreaterThan(one.width);
	});
});
