import type { ManagedPartner } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { AdminPartnerJobsPanel } from "./AdminPartnerJobsPanel";

const partner: ManagedPartner = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
	companyName: "Example Partner",
	primaryEmail: "partner@example.com",
	status: "archived",
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

function AdminPartnerJobsPanelStory({
	initialPartnerId,
	onManageJobs,
}: {
	initialPartnerId: string;
	onManageJobs: () => void;
}) {
	const [selectedPartnerId, setSelectedPartnerId] = useState(initialPartnerId);
	return (
		<AdminPartnerJobsPanel
			partners={[partner]}
			selectedPartnerId={selectedPartnerId}
			isLoading={false}
			error={null}
			onPartnerChange={setSelectedPartnerId}
			onManageJobs={onManageJobs}
		/>
	);
}

const meta = {
	title: "Admin/Partner Jobs Panel",
	component: AdminPartnerJobsPanelStory,
	args: {
		initialPartnerId: partner.id,
		onManageJobs: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof AdminPartnerJobsPanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.click(body.getByRole("button", { name: "Manage jobs" }));
		await expect(args.onManageJobs).toHaveBeenCalledOnce();
	},
};
