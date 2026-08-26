import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expertiseQueryKeys } from "@/features/expertise/expertiseQueryKeys";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useExpertiseData } from "./useExpertiseData";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const profile = {
	user_id: USER_ID,
	editable: true,
	opted_out: false,
	person: null,
	member: null,
	employment: [],
	education: [],
	skills: [],
	projects: [],
	tags: [],
	counts: { confirmed: 0, pending: 0, rejected: 0 },
};

describe("useExpertiseData", () => {
	it("loads validated profile and vocabulary responses", async () => {
		server.use(
			http.get(`/api/expertise/${USER_ID}`, () => HttpResponse.json(profile)),
			http.get("/api/expertise/meta/tags", () =>
				HttpResponse.json({ tags: [] }),
			),
		);
		const { result } = renderHookWithClient(() => useExpertiseData(USER_ID));
		await waitFor(() =>
			expect(result.current.profileQuery.data?.user_id).toBe(USER_ID),
		);
		expect(result.current.tagsQuery.data).toEqual([]);
	});

	it("invalidates the centralized profile key after adding a claim", async () => {
		let gets = 0;
		server.use(
			http.get(`/api/expertise/${USER_ID}`, () => {
				gets += 1;
				return HttpResponse.json(profile);
			}),
			http.get("/api/expertise/meta/tags", () =>
				HttpResponse.json({ tags: [] }),
			),
			http.post(`/api/expertise/${USER_ID}/claims/skill`, () =>
				HttpResponse.json({ claim: {} }, { status: 201 }),
			),
		);
		const { result, queryClient } = renderHookWithClient(() =>
			useExpertiseData(USER_ID),
		);
		await waitFor(() =>
			expect(result.current.profileQuery.isSuccess).toBe(true),
		);
		await act(async () => {
			await result.current.addClaim.mutateAsync({
				type: "skill",
				body: { skill_name: "Swift" },
			});
		});
		await waitFor(() => expect(gets).toBeGreaterThan(1));
		expect(
			queryClient.getQueryData(expertiseQueryKeys.profile(USER_ID)),
		).toEqual(profile);
	});

	it("surfaces invalid profile payloads as query errors", async () => {
		server.use(
			http.get(`/api/expertise/${USER_ID}`, () =>
				HttpResponse.json({ editable: true }),
			),
			http.get("/api/expertise/meta/tags", () =>
				HttpResponse.json({ tags: [] }),
			),
		);
		const { result } = renderHookWithClient(() => useExpertiseData(USER_ID));
		await waitFor(() => expect(result.current.profileQuery.isError).toBe(true));
	});
});
