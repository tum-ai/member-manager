import type { ManagedPartner } from "@member-manager/shared";
import { describe, expect, it } from "vitest";
import {
	filterPartners,
	formatContractRange,
	partnerKindLabel,
	partnerTierLabel,
} from "./partnerManagementUtils";

function partner(overrides: Partial<ManagedPartner> = {}): ManagedPartner {
	return {
		id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
		companyName: "Example Partner",
		primaryEmail: "partner@example.com",
		status: "active",
		partnerKind: "tier_subscriber",
		tierId: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
		tier: {
			id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
			slug: "gold",
			displayName: "Gold",
			hasCvAccess: true,
			jobQuota: 4,
			eventQuota: {},
		},
		contractStart: "2026-01-01",
		contractEnd: "2026-12-31",
		websiteUrl: null,
		notes: null,
		invitedAt: "2026-01-01T00:00:00.000Z",
		acceptedAt: "2026-01-02T00:00:00.000Z",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-02T00:00:00.000Z",
		...overrides,
	};
}

describe("partnerManagementUtils", () => {
	it("filters by status and company, email, or tier", () => {
		const partners = [
			partner(),
			partner({
				id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c12",
				companyName: "Archived Company",
				primaryEmail: "old@example.com",
				status: "archived",
				partnerKind: "single_job_buyer",
				tier: {
					id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c13",
					slug: "bronze",
					displayName: "Bronze",
					hasCvAccess: false,
					jobQuota: 1,
					eventQuota: {},
				},
			}),
		];

		expect(filterPartners(partners, "gold", "all")).toHaveLength(1);
		expect(filterPartners(partners, "old@", "all")).toHaveLength(1);
		expect(filterPartners(partners, "bronze", "all")).toHaveLength(0);
		expect(filterPartners(partners, "no package", "all")).toHaveLength(1);
		expect(filterPartners(partners, "", "active")).toHaveLength(1);
	});

	it("formats partner types and contract dates", () => {
		expect(partnerKindLabel("single_job_buyer")).toBe("Single job posting");
		expect(partnerTierLabel(partner({ partnerKind: "single_job_buyer" }))).toBe(
			"No package tier",
		);
		expect(formatContractRange("2026-01-01", "2026-12-31", "en-GB")).toBe(
			"01 Jan 2026 - 31 Dec 2026",
		);
	});
});
