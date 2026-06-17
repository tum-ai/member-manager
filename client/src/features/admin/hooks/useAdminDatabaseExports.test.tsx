import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMember } from "@/features/admin/adminUtils";
import { useAdminDatabase } from "./useAdminDatabase";

const writeFileMock = vi.fn();

vi.mock("xlsx", () => ({
	utils: {
		json_to_sheet: vi.fn(() => ({ sheet: true })),
		book_new: vi.fn(() => ({ book: true })),
		book_append_sheet: vi.fn(),
	},
	writeFile: (...args: unknown[]) => writeFileMock(...args),
}));

const updateMemberAsyncMock = vi.fn();

const adminDataState: {
	members: AdminMember[];
	totalMembers: number;
	isLoading: boolean;
	isLoadingMoreMembers: boolean;
	isRefreshingMembers: boolean;
	error: Error | null;
	updateMemberAsync: typeof updateMemberAsyncMock;
	isSavingMember: boolean;
} = {
	members: [],
	totalMembers: 0,
	isLoading: false,
	isLoadingMoreMembers: false,
	isRefreshingMembers: false,
	error: null,
	updateMemberAsync: updateMemberAsyncMock,
	isSavingMember: false,
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
		phone: "",
		department: "Software Development",
		member_role: "Member",
		active: true,
		sepa: null,
		...overrides,
	} as AdminMember;
}

describe("useAdminDatabase exports", () => {
	let clickSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		writeFileMock.mockReset();
		updateMemberAsyncMock.mockReset();
		adminDataState.members = [
			member({ user_id: "1", surname: "Zeta", email: "zeta@example.com" }),
			member({ user_id: "2", surname: "Alpha", email: "alpha@example.com" }),
			member({ user_id: "3", surname: "Beta", email: "" }),
		];
		adminDataState.totalMembers = 2;
		adminDataState.isSavingMember = false;

		// jsdom lacks URL.createObjectURL / revokeObjectURL.
		(URL as unknown as { createObjectURL: () => string }).createObjectURL =
			vi.fn(() => "blob:fake");
		(URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL =
			vi.fn();
		clickSpy = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
	});

	afterEach(() => {
		clickSpy.mockRestore();
	});

	it("exports filtered rows to an .xlsx workbook", () => {
		const { result } = renderHook(() => useAdminDatabase());

		act(() => result.current.exportToExcel());

		expect(writeFileMock).toHaveBeenCalledWith(
			expect.anything(),
			"members_export.xlsx",
		);
	});

	it("exports filtered rows to a downloadable CSV", () => {
		const { result } = renderHook(() => useAdminDatabase());

		act(() => result.current.exportToCsv());

		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
		expect(clickSpy).toHaveBeenCalledTimes(1);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
	});

	it("downloads only non-empty emails of filtered members", () => {
		const { result } = renderHook(() => useAdminDatabase());

		const blobSpy = vi.spyOn(globalThis, "Blob");
		act(() => result.current.downloadEmails());

		expect(blobSpy).toHaveBeenCalled();
		const [parts] = blobSpy.mock.calls[0];
		expect((parts as string[])[0]).toBe("alpha@example.com, zeta@example.com");
		expect(clickSpy).toHaveBeenCalledTimes(1);
		blobSpy.mockRestore();
	});

	it("passes through the member update mutation and saving flag", () => {
		adminDataState.isSavingMember = true;
		const { result } = renderHook(() => useAdminDatabase());

		expect(result.current.isSavingMember).toBe(true);
		result.current.updateMemberAsync({ userId: "1" } as never);
		expect(updateMemberAsyncMock).toHaveBeenCalledWith({ userId: "1" });
	});
});
