import type {
	ManagedPartner,
	PartnerManagementData,
	PartnerTier,
} from "@member-manager/shared";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { usePartnerManagement } from "./usePartnerManagement";

const showToast = vi.fn();
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

const tier: PartnerTier = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
	slug: "gold",
	displayName: "Gold",
	hasCvAccess: true,
	jobQuota: 4,
	eventQuota: {},
	displayOrder: 3,
};

const managedPartner: ManagedPartner = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
	companyName: "Example Partner",
	primaryEmail: "partner@example.com",
	status: "invited",
	partnerKind: "tier_subscriber",
	tierId: tier.id,
	tier: {
		id: tier.id,
		slug: tier.slug,
		displayName: tier.displayName,
		hasCvAccess: tier.hasCvAccess,
		jobQuota: tier.jobQuota,
		eventQuota: tier.eventQuota,
	},
	contractStart: "2026-01-01",
	contractEnd: "2026-12-31",
	websiteUrl: "https://example.com",
	notes: null,
	invitedAt: "2026-01-01T00:00:00.000Z",
	acceptedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const data: PartnerManagementData = {
	partners: [managedPartner],
	tiers: [tier],
};

describe("usePartnerManagement", () => {
	beforeEach(() => {
		showToast.mockClear();
		server.use(http.get("/api/partners", () => HttpResponse.json(data)));
	});

	it("loads and filters the partner roster", async () => {
		const { result } = renderHookWithClient(() => usePartnerManagement());
		await waitFor(() => expect(result.current.partners).toHaveLength(1));

		act(() => result.current.setSearchTerm("missing"));
		expect(result.current.partners).toHaveLength(0);
		act(() => result.current.setSearchTerm("gold"));
		expect(result.current.partners).toHaveLength(1);
	});

	it("creates a partner and exposes its activation link", async () => {
		let received: unknown;
		server.use(
			http.post("/api/partners", async ({ request }) => {
				received = await request.json();
				return HttpResponse.json(
					{
						partnerId: managedPartner.id,
						activationLink: "https://partnerportal.test/invite",
						activationEmailSent: true,
					},
					{ status: 201 },
				);
			}),
		);
		const { result } = renderHookWithClient(() => usePartnerManagement());
		await waitFor(() => expect(result.current.partners).toHaveLength(1));

		act(() => result.current.openCreate());
		act(() => {
			result.current.form.reset({
				companyName: "New Partner",
				primaryEmail: "new@example.com",
				tierId: tier.id,
				contractStart: "2026-01-01",
				contractEnd: "2026-12-31",
				partnerKind: "tier_subscriber",
				websiteUrl: "",
				notes: "",
			});
		});
		await act(async () => {
			await result.current.submitForm();
		});

		expect(received).toMatchObject({
			companyName: "New Partner",
			primaryEmail: "new@example.com",
			tierId: tier.id,
		});
		expect(result.current.activation?.link).toBe(
			"https://partnerportal.test/invite",
		);
		expect(showToast).toHaveBeenCalledWith("Partner created.", "success");
	});

	it("updates a partner without sending the immutable email", async () => {
		let received: unknown;
		server.use(
			http.patch("/api/partners/:id", async ({ request }) => {
				received = await request.json();
				return HttpResponse.json({ ok: true });
			}),
		);
		const { result } = renderHookWithClient(() => usePartnerManagement());
		await waitFor(() => expect(result.current.partners).toHaveLength(1));

		act(() => result.current.openEdit(managedPartner));
		act(() => result.current.form.setValue("companyName", "Renamed Partner"));
		await act(async () => {
			await result.current.submitForm();
		});

		expect(received).toMatchObject({ companyName: "Renamed Partner" });
		expect(received).not.toHaveProperty("primaryEmail");
		expect(showToast).toHaveBeenCalledWith("Partner updated.", "success");
	});

	it("generates a replacement activation link", async () => {
		server.use(
			http.post("/api/partners/:id/activation-link", () =>
				HttpResponse.json({
					inviteLink: "https://partnerportal.test/new-invite",
					activationEmailSent: false,
				}),
			),
		);
		const { result } = renderHookWithClient(() => usePartnerManagement());
		await waitFor(() => expect(result.current.partners).toHaveLength(1));

		act(() => result.current.generateActivationLink(managedPartner));
		await waitFor(() =>
			expect(result.current.activation?.link).toContain("new-invite"),
		);
	});
});
