import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EngagementCertificateRequest } from "@/hooks/useEngagementCertificateRequests";
import type { EngagementFormSchema } from "@/lib/schemas";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";

import { useEngagementCertificateForm } from "./useEngagementCertificateForm";

const { showToast, generatePdf, downloadPdfBlob } = vi.hoisted(() => ({
	showToast: vi.fn(),
	generatePdf: vi.fn(),
	downloadPdfBlob: vi.fn(),
}));

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("@/lib/pdfUtils", () => ({
	downloadPdfBlob,
	formatGermanDate: () => "01.01.1999",
}));

vi.mock("@/features/certificate/generators/engagementCertificatePdf", () => ({
	generateEngagementCertificatePdf: generatePdf,
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

const member = {
	user_id: "user-123",
	given_name: "Test",
	surname: "User",
	salutation: "",
	date_of_birth: "1999-01-01",
	member_status: "active",
	active: true,
};

function mockMember() {
	server.use(http.get("/api/members/:id", () => HttpResponse.json(member)));
}

function mockRequests(requests: EngagementCertificateRequest[]) {
	server.use(
		http.get("/api/engagement-certificates", () => HttpResponse.json(requests)),
	);
}

const filledEngagement: EngagementFormSchema["engagements"][number] = {
	id: "eng-1",
	startDate: "2025-10-01",
	endDate: "2026-03-31",
	isStillActive: false,
	weeklyHours: "10",
	department: "Software Development",
	isTeamLead: false,
	specialRole: "",
	tasksDescription: "Built internal tooling",
};

describe("useEngagementCertificateForm", () => {
	beforeEach(() => {
		showToast.mockClear();
		generatePdf.mockReset();
		downloadPdfBlob.mockClear();
	});

	it("submits the form and resets it, showing a success toast", async () => {
		mockMember();
		mockRequests([]);
		let body: EngagementFormSchema | null = null;
		server.use(
			http.post("/api/engagement-certificates", async ({ request }) => {
				body = (await request.json()) as EngagementFormSchema;
				return HttpResponse.json({ ok: true });
			}),
		);

		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.member).toBeDefined());

		await act(async () => {
			await result.current.handleSubmitForApproval({
				engagements: [filledEngagement],
			});
		});

		expect(body).toEqual({ engagements: [filledEngagement] });
		expect(showToast).toHaveBeenCalledWith(
			"Certificate request submitted for admin approval.",
			"success",
		);
	});

	it("surfaces an error toast when submission fails", async () => {
		mockMember();
		mockRequests([]);
		server.use(
			http.post("/api/engagement-certificates", () =>
				HttpResponse.json({ message: "boom" }, { status: 500 }),
			),
		);

		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.member).toBeDefined());

		await act(async () => {
			await result.current.handleSubmitForApproval({
				engagements: [filledEngagement],
			});
		});

		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("Error submitting certificate request"),
			"error",
		);
	});

	it("caps engagements at 5 and warns", async () => {
		mockMember();
		mockRequests([]);
		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.member).toBeDefined());

		expect(result.current.fields).toHaveLength(1);
		for (let i = 0; i < 4; i++) {
			act(() => result.current.handleAddEngagement());
		}
		await waitFor(() => expect(result.current.fields).toHaveLength(5));

		act(() => result.current.handleAddEngagement());
		expect(result.current.fields).toHaveLength(5);
		expect(showToast).toHaveBeenCalledWith(
			"Maximum 5 engagements allowed",
			"warning",
		);
	});

	it("keeps at least one engagement and warns on removal", async () => {
		mockMember();
		mockRequests([]);
		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.member).toBeDefined());

		act(() => result.current.handleRemoveEngagement(0));
		expect(result.current.fields).toHaveLength(1);
		expect(showToast).toHaveBeenCalledWith(
			"At least one engagement is required",
			"warning",
		);

		act(() => result.current.handleAddEngagement());
		await waitFor(() => expect(result.current.fields).toHaveLength(2));
		act(() => result.current.handleRemoveEngagement(0));
		await waitFor(() => expect(result.current.fields).toHaveLength(1));
	});

	it("derives the approved request and downloads the generated PDF", async () => {
		mockMember();
		mockRequests([
			{
				id: "req-1",
				user_id: "user-123",
				status: "approved",
				engagements: [filledEngagement],
			},
		]);
		const blob = new Blob(["pdf"]);
		generatePdf.mockResolvedValue(blob);

		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.approvedRequest).toBeDefined());

		await act(async () => {
			await result.current.handleDownloadApproved();
		});

		expect(generatePdf).toHaveBeenCalledWith(member, [filledEngagement]);
		expect(downloadPdfBlob).toHaveBeenCalledWith(
			blob,
			"TUMai_Engagement_Certificate_Test-User.pdf",
		);
		expect(showToast).toHaveBeenCalledWith(
			"Approved certificate downloaded successfully!",
			"success",
		);
	});

	it("shows an error toast when PDF generation fails", async () => {
		mockMember();
		mockRequests([
			{
				id: "req-1",
				user_id: "user-123",
				status: "approved",
				engagements: [filledEngagement],
			},
		]);
		generatePdf.mockRejectedValue(new Error("render failed"));

		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.approvedRequest).toBeDefined());

		await act(async () => {
			await result.current.handleDownloadApproved();
		});

		expect(showToast).toHaveBeenCalledWith(
			"Error generating certificate: render failed",
			"error",
		);
		expect(downloadPdfBlob).not.toHaveBeenCalled();
	});

	it("marks the latest request as pending", async () => {
		mockMember();
		mockRequests([
			{
				id: "req-1",
				user_id: "user-123",
				status: "pending",
				engagements: [filledEngagement],
			},
		]);

		const { result } = renderHookWithClient(() =>
			useEngagementCertificateForm("user-123"),
		);
		await waitFor(() => expect(result.current.isRequestPending).toBe(true));
		expect(result.current.approvedRequest).toBeUndefined();
	});
});
