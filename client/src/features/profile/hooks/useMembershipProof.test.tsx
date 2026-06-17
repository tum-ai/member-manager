import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/types";
import { useMembershipProof } from "./useMembershipProof";

const showToast = vi.fn();
const downloadPdfBlob = vi.fn();
const generateMembershipProofPdf = vi.fn();

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));
vi.mock("../../../lib/pdfUtils", () => ({
	downloadPdfBlob: (...args: unknown[]) => downloadPdfBlob(...args),
}));
vi.mock("../../certificate/generators/membershipProofPdf", () => ({
	generateMembershipProofPdf: (...args: unknown[]) =>
		generateMembershipProofPdf(...args),
}));

const member = {
	given_name: "Ada/",
	surname: "Lovelace",
} as unknown as Member;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("useMembershipProof", () => {
	it("generates, downloads, and sanitizes the filename", async () => {
		const blob = new Blob(["pdf"]);
		generateMembershipProofPdf.mockResolvedValue(blob);

		const { result } = renderHook(() => useMembershipProof(member));

		await act(async () => {
			await result.current.handleDownloadMembershipProof();
		});

		expect(generateMembershipProofPdf).toHaveBeenCalledWith(member);
		expect(downloadPdfBlob).toHaveBeenCalledWith(
			blob,
			"TUMai_Membership_Proof_Ada--Lovelace.pdf",
		);
		expect(showToast).toHaveBeenCalledWith(
			"Membership proof downloaded!",
			"success",
		);
		expect(result.current.isGeneratingPdf).toBe(false);
	});

	it("does nothing when there is no member", async () => {
		const { result } = renderHook(() => useMembershipProof(null));

		await act(async () => {
			await result.current.handleDownloadMembershipProof();
		});

		expect(generateMembershipProofPdf).not.toHaveBeenCalled();
	});

	it("surfaces errors as a toast", async () => {
		generateMembershipProofPdf.mockRejectedValue(new Error("boom"));

		const { result } = renderHook(() => useMembershipProof(member));

		await act(async () => {
			await result.current.handleDownloadMembershipProof();
		});

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith(
				"Failed to generate PDF: boom",
				"error",
			),
		);
		expect(downloadPdfBlob).not.toHaveBeenCalled();
	});
});
