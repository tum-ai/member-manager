import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import type { Member } from "@/types";
import { useMemberGraph } from "./useMemberGraph";

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Example",
		given_name: "Member",
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

const members: Member[] = [
	buildMember({
		user_id: "a",
		given_name: "Ada",
		surname: "A",
		batch: "WS24",
		school: "TUM",
	}),
	buildMember({
		user_id: "b",
		given_name: "Ben",
		surname: "B",
		batch: "WS24",
		school: "TUM",
	}),
	buildMember({
		user_id: "c",
		given_name: "Cara",
		surname: "C",
		batch: "SS22",
		school: "LMU",
	}),
];

function stubMembers(payload: Member[] = members): void {
	server.use(http.get("/api/members", () => HttpResponse.json(payload)));
}

describe("useMemberGraph", () => {
	it("builds a graph from the members list with a default selection", async () => {
		stubMembers();
		const { result } = renderHookWithClient(() => useMemberGraph());

		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.graph.nodes).toHaveLength(3);
		// Ada and Ben share a batch, so exactly one rendered edge.
		expect(result.current.graph.edges).toHaveLength(1);
		await waitFor(() => expect(result.current.selectedId).not.toBeNull());
		expect(result.current.selectedNode).not.toBeNull();
	});

	it("toggles reason kinds without ever clearing them all", async () => {
		stubMembers();
		const { result } = renderHookWithClient(() => useMemberGraph());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		expect(result.current.reasonKinds).toContain("batch");
		expect(result.current.reasonKinds).not.toContain("school");

		act(() =>
			result.current.setReasonKinds([...result.current.reasonKinds, "school"]),
		);
		expect(result.current.reasonKinds).toContain("school");
		// School links Ada+Ben (TUM) too, but batch already connects them.
		expect(result.current.graph.edges.length).toBeGreaterThanOrEqual(1);

		// Clearing every reason is a no-op — the graph never goes blank.
		act(() => result.current.setReasonKinds([]));
		expect(result.current.reasonKinds.length).toBeGreaterThan(0);
	});

	it("excludes inactive members and respects the alumni toggle", async () => {
		stubMembers([
			...members,
			buildMember({
				user_id: "alum",
				given_name: "Al",
				surname: "Umni",
				member_status: "alumni",
				batch: "WS24",
			}),
			buildMember({
				user_id: "gone",
				given_name: "In",
				surname: "Active",
				member_status: "inactive",
				batch: "WS24",
			}),
		]);
		const { result } = renderHookWithClient(() => useMemberGraph());
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		// Alumni shown by default (showAlumni=true), inactive always excluded.
		expect(result.current.graph.nodes).toHaveLength(4);
		expect(result.current.graph.nodes.some((node) => node.id === "gone")).toBe(
			false,
		);

		act(() => result.current.setShowAlumni(false));
		expect(result.current.graph.nodes).toHaveLength(3);
	});
});
