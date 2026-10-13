import type { DoorPinImportResult } from "@member-manager/shared";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SheetCell } from "@/features/admin/doorPinImportUtils";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { type ReadSheet, useAdminDoorPinImport } from "./useAdminDoorPinImport";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const SHEET: SheetCell[][] = [
	["Vorname", "Nachname", "Kontakt", "UserID", "PIN", "Admin"],
	["admin", "tum.ai", "it@example.com", "uuid", "ab12", "Y"],
	["Ada", "Lovelace", "ada@example.com", null, 482913],
	["Grace", "Hopper", "stranger@example.com", null, 135790],
];

function importResult(
	overrides: Partial<DoorPinImportResult> = {},
): DoorPinImportResult {
	return {
		dry_run: true,
		total: 2,
		matched: 1,
		created: 1,
		updated: 0,
		unchanged: 0,
		unmatched: [
			{ row_number: 4, email: "stranger@example.com", name: "Grace Hopper" },
		],
		rejected: [],
		members_without_pin: [],
		...overrides,
	};
}

const file = new File(["xlsx"], "traka.xlsx");
const readSheet: ReadSheet = vi.fn(async () => SHEET);

beforeEach(() => {
	showToast.mockReset();
});

describe("useAdminDoorPinImport", () => {
	it("reads the sheet, sends only member rows for a dry run, and previews it", async () => {
		const requests: unknown[] = [];
		server.use(
			http.post("/api/admin/door-pins/import", async ({ request }) => {
				requests.push(await request.json());
				return HttpResponse.json(importResult());
			}),
		);
		const { result } = renderHookWithClient(() =>
			useAdminDoorPinImport({ readSheet }),
		);

		act(() => result.current.openDialog());
		expect(result.current.isOpen).toBe(true);
		await act(async () => {
			await result.current.selectFile(file);
		});

		expect(requests).toEqual([
			{
				dry_run: true,
				rows: [
					{
						row_number: 3,
						email: "ada@example.com",
						pin: "482913",
						given_name: "Ada",
						surname: "Lovelace",
					},
					{
						row_number: 4,
						email: "stranger@example.com",
						pin: "135790",
						given_name: "Grace",
						surname: "Hopper",
					},
				],
			},
		]);
		expect(result.current.step).toBe("preview");
		expect(result.current.fileName).toBe("traka.xlsx");
		expect(result.current.pendingChanges).toBe(1);
		expect(result.current.skipped).toEqual([
			{
				row_number: 2,
				email: "it@example.com",
				name: "admin tum.ai",
				reason: "cabinet_admin",
			},
		]);
	});

	it("applies the same rows and refreshes PIN views", async () => {
		const dryRuns: boolean[] = [];
		server.use(
			http.post("/api/admin/door-pins/import", async ({ request }) => {
				const body = (await request.json()) as { dry_run: boolean };
				dryRuns.push(body.dry_run);
				return HttpResponse.json(importResult({ dry_run: body.dry_run }));
			}),
		);
		const { result, queryClient } = renderHookWithClient(() =>
			useAdminDoorPinImport({ readSheet }),
		);
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		await act(async () => {
			await result.current.selectFile(file);
		});
		await act(async () => {
			await result.current.applyImport();
		});

		expect(dryRuns).toEqual([true, false]);
		expect(result.current.step).toBe("done");
		expect(result.current.result?.dry_run).toBe(false);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ["door-pin"] });
		expect(showToast).toHaveBeenCalledWith("Imported 1 door PIN.", "success");
	});

	it("explains a file that isn't a cabinet sheet without calling the server", async () => {
		const handler = vi.fn(() => HttpResponse.json(importResult()));
		server.use(http.post("/api/admin/door-pins/import", handler));
		const { result } = renderHookWithClient(() =>
			useAdminDoorPinImport({
				readSheet: async () => [
					["Name", "Email"],
					["Ada", "ada@example.com"],
				],
			}),
		);

		await act(async () => {
			await result.current.selectFile(file);
		});

		expect(handler).not.toHaveBeenCalled();
		expect(result.current.step).toBe("select");
		expect(result.current.fileError).toMatch(/Traka21 user sheet/);
	});

	it("explains an unreadable file", async () => {
		const { result } = renderHookWithClient(() =>
			useAdminDoorPinImport({
				readSheet: async () => {
					throw new Error("Invalid spreadsheet");
				},
			}),
		);

		await act(async () => {
			await result.current.selectFile(file);
		});

		expect(result.current.fileError).toBe("Invalid spreadsheet");
	});

	it("surfaces a failed apply and keeps the preview", async () => {
		server.use(
			http.post("/api/admin/door-pins/import", async ({ request }) => {
				const body = (await request.json()) as { dry_run: boolean };
				return body.dry_run
					? HttpResponse.json(importResult())
					: HttpResponse.json({ error: "Database error" }, { status: 500 });
			}),
		);
		const { result } = renderHookWithClient(() =>
			useAdminDoorPinImport({ readSheet }),
		);

		await act(async () => {
			await result.current.selectFile(file);
		});
		await act(async () => {
			await result.current.applyImport();
		});

		expect(showToast).toHaveBeenCalledWith("Database error", "error");
		expect(result.current.step).toBe("preview");
	});

	it("closing resets everything", async () => {
		server.use(
			http.post("/api/admin/door-pins/import", () =>
				HttpResponse.json(importResult()),
			),
		);
		const { result } = renderHookWithClient(() =>
			useAdminDoorPinImport({ readSheet }),
		);
		act(() => result.current.openDialog());
		await act(async () => {
			await result.current.selectFile(file);
		});

		act(() => result.current.closeDialog());

		await waitFor(() => expect(result.current.isOpen).toBe(false));
		expect(result.current.result).toBeNull();
		expect(result.current.step).toBe("select");
		expect(result.current.fileName).toBe("");
	});

	it("ignores an empty file selection", async () => {
		const { result } = renderHookWithClient(() =>
			useAdminDoorPinImport({ readSheet }),
		);

		await act(async () => {
			await result.current.selectFile(undefined);
		});

		expect(readSheet).not.toHaveBeenCalledWith(undefined);
		expect(result.current.fileName).toBe("");
	});
});
