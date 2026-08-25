import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useContractBoardSignPage } from "./useContractBoardSignPage";

vi.mock("react-router-dom", () => ({
	useParams: () => ({ token: "board-token" }),
}));

describe("useContractBoardSignPage", () => {
	it("loads the partner signed PDF and submits the board signature", async () => {
		URL.createObjectURL = vi.fn(() => "blob:board-pdf");
		URL.revokeObjectURL = vi.fn();
		let posted: unknown = null;
		server.use(
			http.get("/api/contracts/board-sign/board-token", () =>
				HttpResponse.json({
					status: "partner_signed",
					partner_signer_name: "Jane Partner",
					partner_signature_data: "data:image/png;base64,AAAA",
					partner_signed_at: "2026-08-19T10:00:00Z",
					pdf_url: "/api/contracts/board-sign/board-token/pdf",
					document_status: "ready",
				}),
			),
			http.get(
				"/api/contracts/board-sign/board-token/pdf",
				() => new HttpResponse(new Blob(["pdf"], { type: "application/pdf" })),
			),
			http.post(
				"/api/contracts/board-sign/board-token",
				async ({ request }) => {
					posted = await request.json();
					return HttpResponse.json({ status: "board_signed" });
				},
			),
		);

		const { result } = renderHookWithClient(() => useContractBoardSignPage());
		await waitFor(() => expect(result.current.pdfUrl).toBe("blob:board-pdf"));

		act(() => {
			result.current.submitSignature({
				signer_name: "Board Member",
				signature_data: "data:image/png;base64,BBBB",
			});
		});

		await waitFor(() => expect(result.current.submitted).toBe(true));
		expect(posted).toEqual({
			signer_name: "Board Member",
			signature_data: "data:image/png;base64,BBBB",
		});
	});
});
