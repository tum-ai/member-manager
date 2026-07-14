import { describe, expect, it } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import {
	fetchPublicBoardSignPayload,
	fetchPublicSignPayload,
	postPublicBoardSignature,
} from "./contractApi";

describe("public contract API", () => {
	it("fetches and posts the public board-signing payload", async () => {
		server.use(
			http.get("/api/contracts/board-sign/board-token", () =>
				HttpResponse.json({
					contract_text: "Body",
					html: "<section>Body</section>",
					pages: ["Body"],
					status: "partner_signed",
					partner_signer_name: "Jane",
					partner_signature_data: "data:image/png;base64,AAAA",
					partner_signed_at: "2026-07-01T00:00:00Z",
				}),
			),
		);
		let posted: unknown = null;
		server.use(
			http.post(
				"/api/contracts/board-sign/board-token",
				async ({ request }) => {
					posted = await request.json();
					return HttpResponse.json({ id: "sub-1", status: "board_signed" });
				},
			),
		);

		const payload = await fetchPublicBoardSignPayload("board-token");
		expect(payload.partner_signer_name).toBe("Jane");

		await postPublicBoardSignature("board-token", {
			signature_data: "data:image/png;base64,BBBB",
			signer_name: "Board Member",
		});
		expect(posted).toEqual({
			signature_data: "data:image/png;base64,BBBB",
			signer_name: "Board Member",
		});
	});

	it("uses the API error from failed public requests", async () => {
		server.use(
			http.get("/api/contracts/sign/expired-token", () =>
				HttpResponse.json({ error: "Signing link expired" }, { status: 410 }),
			),
		);

		await expect(fetchPublicSignPayload("expired-token")).rejects.toThrow(
			"Signing link expired",
		);
	});
});
