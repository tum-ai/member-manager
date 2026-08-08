import type { ManagedPartner } from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminPartnerJobsPanel } from "./AdminPartnerJobsPanel";

const partner: ManagedPartner = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
	companyName: "Example Partner",
	primaryEmail: "partner@example.com",
	status: "active",
	partnerKind: "single_job_buyer",
	tierId: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
	tier: null,
	contractStart: "2026-01-01",
	contractEnd: "2026-12-31",
	websiteUrl: null,
	notes: null,
	invitedAt: "2026-01-01T00:00:00.000Z",
	acceptedAt: "2026-01-02T00:00:00.000Z",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("AdminPartnerJobsPanel", () => {
	it("selects a partner before opening job management", async () => {
		const user = userEvent.setup();
		const onPartnerChange = vi.fn();
		const onManageJobs = vi.fn();
		const { rerender } = render(
			<AdminPartnerJobsPanel
				partners={[partner]}
				selectedPartnerId=""
				isLoading={false}
				error={null}
				onPartnerChange={onPartnerChange}
				onManageJobs={onManageJobs}
			/>,
		);

		expect(screen.getByRole("button", { name: "Manage jobs" })).toBeDisabled();
		await user.click(
			screen.getByRole("combobox", { name: "Partner organization" }),
		);
		await user.click(screen.getByRole("option", { name: "Example Partner" }));
		expect(onPartnerChange).toHaveBeenCalledWith(partner.id);

		rerender(
			<AdminPartnerJobsPanel
				partners={[partner]}
				selectedPartnerId={partner.id}
				isLoading={false}
				error={null}
				onPartnerChange={onPartnerChange}
				onManageJobs={onManageJobs}
			/>,
		);
		await user.click(screen.getByRole("button", { name: "Manage jobs" }));
		expect(onManageJobs).toHaveBeenCalledOnce();
	});
});
