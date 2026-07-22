import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useToolAccess } from "./useToolAccess";

describe("useToolAccess", () => {
	it("returns permissions and board membership from /api/me/tool-access", async () => {
		server.use(
			http.get("/api/me/tool-access", () =>
				HttpResponse.json({
					permissions: ["contracts.admin"],
					isBoardMember: true,
					department: "Legal & Finance",
				}),
			),
		);

		const { result } = renderHookWithClient(() => useToolAccess());

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.permissions).toEqual(["contracts.admin"]);
		expect(result.current.isBoardMember).toBe(true);
		expect(result.current.department).toBe("Legal & Finance");
	});

	it("defaults isBoardMember to false when the field is missing", async () => {
		server.use(
			http.get("/api/me/tool-access", () =>
				HttpResponse.json({ permissions: [] }),
			),
		);

		const { result } = renderHookWithClient(() => useToolAccess());

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.isBoardMember).toBe(false);
	});
});
