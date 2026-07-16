import type {
	ManagedPartner,
	ManagedPartnerJob,
	PartnerJobInput,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "react-hook-form";
import { expect, fn, userEvent, within } from "storybook/test";
import { PartnerJobsDialog } from "./PartnerJobsDialog";

const partner: ManagedPartner = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c10",
	companyName: "Example Partner",
	primaryEmail: "partner@example.com",
	status: "active",
	partnerKind: "single_job_buyer",
	tierId: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
	tier: {
		id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
		slug: "bronze",
		displayName: "Bronze",
		hasCvAccess: false,
		jobQuota: 1,
		eventQuota: {},
	},
	contractStart: "2026-01-01",
	contractEnd: "2026-12-31",
	websiteUrl: "https://example.com",
	notes: null,
	invitedAt: "2026-01-01T00:00:00.000Z",
	acceptedAt: "2026-01-02T00:00:00.000Z",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-02T00:00:00.000Z",
};

const job: ManagedPartnerJob = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c12",
	partnerId: partner.id,
	title: "AI Engineer",
	jobType: "full_time",
	location: "Munich",
	description:
		"Build reliable production AI systems with our engineering team.",
	callToAction: "Apply now",
	contactName: "Taylor Example",
	contactEmail: "jobs@example.com",
	contactRole: "Talent",
	externalUrl: "https://example.com/jobs",
	logoUrl: null,
	status: "approved",
	submittedAt: "2026-07-16T17:00:00.000Z",
	publishedAt: "2026-07-16T17:00:00.000Z",
	expiresAt: null,
	createdAt: "2026-07-16T17:00:00.000Z",
	updatedAt: "2026-07-16T17:00:00.000Z",
};

function PartnerJobsDialogStory({
	onEdit,
	onDelete,
	jobs,
	isLoading,
}: {
	onEdit: (job: ManagedPartnerJob) => void;
	onDelete: (job: ManagedPartnerJob) => void;
	jobs: ManagedPartnerJob[];
	isLoading: boolean;
}) {
	const form = useForm<PartnerJobInput>();
	return (
		<PartnerJobsDialog
			partner={partner}
			jobs={jobs}
			isLoading={isLoading}
			error={null}
			editorMode={null}
			form={form}
			onOpenChange={() => {}}
			onCreate={() => {}}
			onEdit={onEdit}
			onCancelEdit={() => {}}
			onSubmit={() => {}}
			onDelete={onDelete}
			isSaving={false}
		/>
	);
}

const meta = {
	title: "Partner Management/Partner Jobs Dialog",
	component: PartnerJobsDialogStory,
	args: {
		onEdit: fn(),
		onDelete: fn(),
		jobs: [job],
		isLoading: false,
	},
} satisfies Meta<typeof PartnerJobsDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleJobAccount: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		await expect(
			body.getByText("1 job posting | CV access disabled"),
		).toBeVisible();
		await expect(body.getByRole("button", { name: "Add job" })).toBeDisabled();
		await userEvent.click(
			body.getByRole("button", { name: "Edit AI Engineer" }),
		);
		await expect(args.onEdit).toHaveBeenCalledWith(job);
	},
};

export const Loading: Story = {
	args: {
		jobs: [],
		isLoading: true,
	},
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		await expect(body.getByRole("button", { name: "Add job" })).toBeDisabled();
	},
};
