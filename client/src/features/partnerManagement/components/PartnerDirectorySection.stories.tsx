import type { ManagedPartner } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PartnerDirectorySection } from "./PartnerDirectorySection";

const partner: ManagedPartner = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
	companyName: "Example Partner",
	primaryEmail: "partner@example.com",
	status: "invited",
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
	websiteUrl: "https://example.com",
	notes: null,
	invitedAt: "2026-01-01T00:00:00.000Z",
	acceptedAt: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const meta = {
	title: "Partner Management/Partner Directory",
	component: PartnerDirectorySection,
	parameters: { layout: "padded" },
	args: {
		partners: [partner],
		archivedPartners: [],
		totalCount: 1,
		searchTerm: "",
		onSearchTermChange: fn(),
		statusFilter: "all",
		onStatusFilterChange: fn(),
		onCreate: fn(),
		onEdit: fn(),
		onManageJobs: fn(),
		onActivationLink: fn(),
		onArchive: fn(),
		onUnarchive: fn(),
		isGeneratingActivationLink: false,
		isUnarchiving: false,
	},
} satisfies Meta<typeof PartnerDirectorySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: /add partner/i }));
		await expect(args.onCreate).toHaveBeenCalledOnce();

		const editButtons = canvas.getAllByRole("button", {
			name: /edit example partner/i,
		});
		await userEvent.click(editButtons[0]);
		await expect(args.onEdit).toHaveBeenCalledWith(partner);

		const jobButtons = canvas.getAllByRole("button", {
			name: /manage jobs for example partner/i,
		});
		await userEvent.click(jobButtons[0]);
		await expect(args.onManageJobs).toHaveBeenCalledWith(partner);
	},
};

export const ActivationPending: Story = {
	args: { isGeneratingActivationLink: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const activationButtons = canvas.getAllByRole("button", {
			name: /generate activation link for example partner/i,
		});
		for (const button of activationButtons) {
			await expect(button).toBeDisabled();
		}
	},
};

export const ArchivedCollapsed: Story = {
	args: {
		partners: [],
		archivedPartners: [{ ...partner, status: "archived" }],
		totalCount: 0,
		onUnarchive: fn(),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("Example Partner")).not.toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole("button", { name: /archived partners/i }),
		);
		await expect(canvas.getAllByText("Example Partner")[0]).toBeVisible();
		const restoreButtons = canvas.getAllByRole("button", {
			name: /restore example partner/i,
		});
		await userEvent.click(restoreButtons[0]);
		await expect(args.onUnarchive).toHaveBeenCalledWith({
			...partner,
			status: "archived",
		});
	},
};
