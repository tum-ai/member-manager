import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useContractSignPage } from "./useContractSignPage";

vi.mock("react-router-dom", () => ({
	useParams: () => ({ token: "partner-token" }),
}));

describe("useContractSignPage", () => {
	it("loads the stored PDF and submits the partner signature", async () => {
		URL.createObjectURL = vi.fn(() => "blob:partner-pdf");
		URL.revokeObjectURL = vi.fn();
		let posted: unknown = null;
		server.use(
			http.get("/api/contracts/sign/partner-token", () =>
				HttpResponse.json({
					status: "sent_to_partner",
					comments: [],
					pdf_url: "/api/contracts/sign/partner-token/pdf",
					document_status: "ready",
				}),
			),
			http.get(
				"/api/contracts/sign/partner-token/pdf",
				() => new HttpResponse(new Blob(["pdf"], { type: "application/pdf" })),
			),
			http.post("/api/contracts/sign/partner-token", async ({ request }) => {
				posted = await request.json();
				return HttpResponse.json({ status: "partner_signed" });
			}),
		);

		const { result } = renderHookWithClient(() => useContractSignPage());
		await waitFor(() => expect(result.current.pdfUrl).toBe("blob:partner-pdf"));

		act(() => {
			result.current.submitSignature({
				signer_name: "Jane Partner",
				signature_data: "data:image/png;base64,AAAA",
			});
		});

		await waitFor(() => expect(result.current.submitted).toBe(true));
		expect(posted).toEqual({
			signer_name: "Jane Partner",
			signature_data: "data:image/png;base64,AAAA",
		});
	});
});
