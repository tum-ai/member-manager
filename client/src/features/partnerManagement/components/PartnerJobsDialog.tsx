import type {
	ManagedPartner,
	ManagedPartnerJob,
	PartnerJobInput,
	PartnerJobStatus,
} from "@member-manager/shared";
import {
	Archive,
	BriefcaseBusiness,
	Pencil,
	Plus,
	TriangleAlert,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	PARTNER_JOB_STATUS_LABELS,
	PARTNER_JOB_TYPE_LABELS,
} from "@/features/partnerManagement/partnerManagementUtils";
import { PartnerJobForm } from "./PartnerJobForm";

const STATUS_VARIANTS: Record<PartnerJobStatus, BadgeVariant> = {
	draft: "neutral",
	pending_review: "warning",
	approved: "success",
	rejected: "danger",
	archived: "neutral",
};

interface PartnerJobsDialogProps {
	partner: ManagedPartner | null;
	jobs: ManagedPartnerJob[];
	isLoading: boolean;
	error: Error | null;
	editorMode: "create" | "edit" | null;
	form: UseFormReturn<PartnerJobInput>;
	onOpenChange: (open: boolean) => void;
	onCreate: () => void;
	onEdit: (job: ManagedPartnerJob) => void;
	onCancelEdit: () => void;
	onSubmit: () => void;
	onDelete: (job: ManagedPartnerJob) => void;
	isSaving: boolean;
}

function entitlementLabel(partner: ManagedPartner): string {
	if (partner.partnerKind === "single_job_buyer") {
		return "1 job posting | CV access disabled";
	}
	const quota = partner.tier?.jobQuota ?? 0;
	const jobLabel = quota === 1 ? "1 live job" : `${quota} live jobs`;
	return `${partner.tier?.displayName ?? "Unknown tier"} | ${jobLabel} | ${
		partner.tier?.hasCvAccess ? "CV access enabled" : "CV access disabled"
	}`;
}

function canCreateJob(
	partner: ManagedPartner,
	jobs: ManagedPartnerJob[],
): boolean {
	if (partner.status === "archived" || partner.status === "expired")
		return false;
	if (partner.partnerKind === "single_job_buyer") return jobs.length < 1;
	const quota = partner.tier?.jobQuota ?? 0;
	if (quota <= 0) return true;
	return jobs.filter((job) => job.status === "approved").length < quota;
}

export function PartnerJobsDialog({
	partner,
	jobs,
	isLoading,
	error,
	editorMode,
	form,
	onOpenChange,
	onCreate,
	onEdit,
	onCancelEdit,
	onSubmit,
	onDelete,
	isSaving,
}: PartnerJobsDialogProps) {
	const editing = editorMode !== null;

	return (
		<Dialog open={!!partner} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>
						{editing
							? `${editorMode === "create" ? "Add" : "Edit"} job - ${partner?.companyName ?? ""}`
							: `Jobs - ${partner?.companyName ?? ""}`}
					</DialogTitle>
					<DialogDescription>
						{partner ? entitlementLabel(partner) : ""}
					</DialogDescription>
				</DialogHeader>

				{editing ? (
					<PartnerJobForm
						form={form}
						onSubmit={onSubmit}
						onCancel={onCancelEdit}
						isSaving={isSaving}
						submitLabel={editorMode === "edit" ? "Save changes" : "Publish job"}
					/>
				) : (
					<div className="space-y-4">
						<div className="flex justify-end">
							<Button
								className="bg-[#9A64D9] text-white hover:bg-[#523573]"
								onClick={onCreate}
								disabled={
									isLoading ||
									!!error ||
									!partner ||
									!canCreateJob(partner, jobs)
								}
							>
								<Plus />
								Add job
							</Button>
						</div>

						{isLoading ? (
							<div className="space-y-2">
								<Skeleton className="h-20 w-full" />
								<Skeleton className="h-20 w-full" />
							</div>
						) : error ? (
							<Alert variant="destructive">
								<TriangleAlert />
								<AlertDescription>{error.message}</AlertDescription>
							</Alert>
						) : jobs.length === 0 ? (
							<div className="grid justify-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
								<BriefcaseBusiness className="size-6" />
								No active job postings.
							</div>
						) : (
							<div className="divide-y rounded-md border">
								{jobs.map((job) => (
									<div
										key={job.id}
										className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
									>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<div className="font-medium">{job.title}</div>
												<Badge variant={STATUS_VARIANTS[job.status]}>
													{PARTNER_JOB_STATUS_LABELS[job.status]}
												</Badge>
											</div>
											<div className="mt-1 text-xs text-muted-foreground">
												{PARTNER_JOB_TYPE_LABELS[job.jobType]} | {job.location}{" "}
												| {job.contactEmail}
											</div>
										</div>
										<TooltipProvider>
											<div className="flex justify-end gap-1">
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															size="icon-sm"
															variant="ghost"
															aria-label={`Edit ${job.title}`}
															onClick={() => onEdit(job)}
														>
															<Pencil />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Edit job</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															size="icon-sm"
															variant="ghost"
															aria-label={`Archive ${job.title}`}
															onClick={() => onDelete(job)}
														>
															<Archive />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Archive job</TooltipContent>
												</Tooltip>
											</div>
										</TooltipProvider>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
