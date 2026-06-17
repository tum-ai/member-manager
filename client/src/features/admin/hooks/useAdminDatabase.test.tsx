import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMember } from "../adminUtils";
import { useAdminDatabase } from "./useAdminDatabase";

const adminDataState: {
	members: AdminMember[];
	totalMembers: number;
	isLoading: boolean;
	isLoadingMoreMembers: boolean;
	isRefreshingMembers: boolean;
	error: Error | null;
} = {
	members: [],
	totalMembers: 0,
	isLoading: false,
	isLoadingMoreMembers: false,
	isRefreshingMembers: false,
	error: null,
};

vi.mock("../../../hooks/useAdminData", () => ({
	useAdminData: () => adminDataState,
}));

function member(overrides: Partial<AdminMember>): AdminMember {
	return {
		user_id: "u",
		given_name: "G",
		surname: "S",
		email: "g@example.com",
		department: "Software Development",
		member_role: "Member",
		active: true,
		sepa: null,
		...overrides,
	} as AdminMember;
}

describe("useAdminDatabase", () => {
	beforeEach(() => {
		adminDataState.members = [
			member({ user_id: "1", surname: "Zeta", active: true }),
			member({ user_id: "2", surname: "Alpha", active: false }),
			member({
				user_id: "3",
				surname: "Mid",
				active: true,
				sepa: { mandate_agreed: true, privacy_agreed: true },
			}),
		];
		adminDataState.totalMembers = 3;
		adminDataState.isLoadingMoreMembers = false;
		adminDataState.isRefreshingMembers = false;
	});

	it("computes stats from all loaded members", () => {
		const { result } = renderHook(() => useAdminDatabase());

		expect(result.current.stats).toEqual({
			total: 3,
			active: 2,
			sepaAccepted: 1,
			privacyAccepted: 1,
		});
	});

	it("sorts ascending by surname by default and toggles direction", () => {
		const { result } = renderHook(() => useAdminDatabase());

		expect(result.current.filtered.map((m) => m.surname)).toEqual([
			"Alpha",
			"Mid",
			"Zeta",
		]);

		act(() => result.current.handleSortChange("surname"));
		expect(result.current.filtered.map((m) => m.surname)).toEqual([
			"Zeta",
			"Mid",
			"Alpha",
		]);
	});

	it("filters members by the active filter", () => {
		const { result } = renderHook(() => useAdminDatabase());

		act(() => result.current.setFilters((f) => ({ ...f, active: "inactive" })));

		expect(result.current.filtered.map((m) => m.surname)).toEqual(["Alpha"]);
	});

	it("reports the loading message variants", () => {
		const { result, rerender } = renderHook(() => useAdminDatabase());
		expect(result.current.memberLoadingMessage).toBe(
			"3 members match the current filters.",
		);

		adminDataState.isRefreshingMembers = true;
		rerender();
		expect(result.current.memberLoadingMessage).toContain("Refreshing 3");

		adminDataState.isRefreshingMembers = false;
		adminDataState.isLoadingMoreMembers = true;
		rerender();
		expect(result.current.memberLoadingMessage).toContain(
			"Loaded 3 of 3 members",
		);
	});
});
