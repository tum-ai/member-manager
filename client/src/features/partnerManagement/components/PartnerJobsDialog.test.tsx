import type {
	ManagedPartner,
	ManagedPartnerJob,
	PartnerJobInput,
} from "@member-manager/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
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
	websiteUrl: null,
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

const defaults: PartnerJobInput = {
	title: "",
	jobType: "full_time",
	location: "",
	description: "",
	callToAction: "Apply now",
	contactName: "",
	contactEmail: "",
	contactRole: "",
	externalUrl: "",
	logoUrl: "",
};

interface HarnessProps {
	managedPartner?: ManagedPartner;
	jobs?: ManagedPartnerJob[];
	isLoading?: boolean;
	error?: Error | null;
	editorMode?: "create" | "edit" | null;
	onCreate?: () => void;
	onEdit?: (job: ManagedPartnerJob) => void;
	onDelete?: (job: ManagedPartnerJob) => void;
}

function Harness({
	managedPartner = partner,
	jobs = [job],
	isLoading = false,
	error = null,
	editorMode = null,
	onCreate = () => {},
	onEdit = () => {},
	onDelete = () => {},
}: HarnessProps) {
	const form = useForm<PartnerJobInput>({ defaultValues: defaults });
	return (
		<PartnerJobsDialog
			partner={managedPartner}
			jobs={jobs}
			isLoading={isLoading}
			error={error}
			editorMode={editorMode}
			form={form}
			onOpenChange={() => {}}
			onCreate={onCreate}
			onEdit={onEdit}
			onCancelEdit={() => {}}
			onSubmit={() => {}}
			onDelete={onDelete}
			isSaving={false}
		/>
	);
}

describe("PartnerJobsDialog", () => {
	it("shows the entitlement and job actions for a filled single-job slot", async () => {
		const onEdit = vi.fn();
		const onDelete = vi.fn();
		render(<Harness onEdit={onEdit} onDelete={onDelete} />);

		expect(
			screen.getByText("1 job posting | CV access disabled"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add job" })).toBeDisabled();
		await userEvent.click(
			screen.getByRole("button", { name: "Edit AI Engineer" }),
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Archive AI Engineer" }),
		);
		expect(onEdit).toHaveBeenCalledWith(job);
		expect(onDelete).toHaveBeenCalledWith(job);
	});

	it("disables creation while jobs are loading or unavailable", () => {
		const { rerender } = render(<Harness jobs={[]} isLoading />);
		expect(screen.getByRole("button", { name: "Add job" })).toBeDisabled();

		rerender(
			<Harness jobs={[]} error={new Error("Partner jobs unavailable")} />,
		);
		expect(screen.getByText("Partner jobs unavailable")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add job" })).toBeDisabled();
	});

	it("allows an entitled tier subscriber to start the empty job flow", async () => {
		const onCreate = vi.fn();
		render(
			<Harness
				managedPartner={{
					...partner,
					partnerKind: "tier_subscriber",
					tier: {
						id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c13",
						slug: "silver",
						displayName: "Silver",
						hasCvAccess: true,
						jobQuota: 2,
						eventQuota: {},
					},
				}}
				jobs={[]}
				onCreate={onCreate}
			/>,
		);

		expect(
			screen.getByText("Silver | 2 live jobs | CV access enabled"),
		).toBeInTheDocument();
		expect(screen.getByText("No active job postings.")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Add job" }));
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("renders create and edit form modes with the correct action", () => {
		const { rerender } = render(<Harness jobs={[]} editorMode="create" />);
		expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Publish job" }),
		).toBeInTheDocument();

		rerender(<Harness editorMode="edit" />);
		expect(
			screen.getByRole("button", { name: "Save changes" }),
		).toBeInTheDocument();
	});
});
