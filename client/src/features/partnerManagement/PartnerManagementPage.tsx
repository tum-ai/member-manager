import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { ActivationLinkDialog } from "./components/ActivationLinkDialog";
import { PartnerDirectorySection } from "./components/PartnerDirectorySection";
import { PartnerFormDialog } from "./components/PartnerFormDialog";
import { PartnerJobsDialog } from "./components/PartnerJobsDialog";
import { usePartnerManagement } from "./hooks/usePartnerManagement";

export default function PartnerManagementPage(): React.ReactElement {
	const management = usePartnerManagement();

	return (
		<ToolPageShell
			title="Partner Management"
			description="Partner Portal accounts, contracts, access packages, and job postings."
		>
			{management.isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-72 w-full" />
				</div>
			) : management.error ? (
				<Alert variant="destructive">
					<AlertCircle />
					<AlertTitle>Partner data unavailable</AlertTitle>
					<AlertDescription>{management.error.message}</AlertDescription>
				</Alert>
			) : (
				<PartnerDirectorySection
					partners={management.partners}
					archivedPartners={management.archivedPartners}
					totalCount={management.currentPartnerCount}
					searchTerm={management.searchTerm}
					onSearchTermChange={management.setSearchTerm}
					statusFilter={management.statusFilter}
					onStatusFilterChange={management.setStatusFilter}
					onCreate={management.openCreate}
					onEdit={management.openEdit}
					onManageJobs={management.openJobs}
					onActivationLink={management.generateActivationLink}
					onArchive={management.setArchiveTarget}
					onUnarchive={management.setUnarchiveTarget}
					isGeneratingActivationLink={management.isGeneratingActivationLink}
					isUnarchiving={management.isUnarchiving}
				/>
			)}

			<PartnerFormDialog
				open={management.formOpen}
				onOpenChange={management.setFormOpen}
				partner={management.selectedPartner}
				tiers={management.tiers}
				form={management.form}
				onSubmit={management.submitForm}
				isSaving={management.isSaving}
			/>

			<PartnerJobsDialog
				partner={management.jobsPartner}
				jobs={management.jobs}
				isLoading={management.jobsLoading}
				error={management.jobsError}
				editorMode={management.jobEditorMode}
				form={management.jobForm}
				onOpenChange={(open) => {
					if (!open) management.closeJobs();
				}}
				onCreate={management.openCreateJob}
				onEdit={management.openEditJob}
				onCancelEdit={management.cancelJobEdit}
				onSubmit={management.submitJobForm}
				onDelete={management.setJobDeleteTarget}
				isSaving={management.isSavingJob}
			/>

			<ConfirmDialog
				open={!!management.archiveTarget}
				onOpenChange={(open) => {
					if (!open) management.setArchiveTarget(null);
				}}
				title={`Archive ${management.archiveTarget?.companyName ?? "partner"}?`}
				description="The Partner Portal login and audit history remain, but the organization leaves the active roster."
				confirmLabel={
					management.isArchiving ? "Archiving..." : "Archive partner"
				}
				confirmDisabled={management.isArchiving}
				destructive
				onConfirm={management.confirmArchive}
			/>

			<ConfirmDialog
				open={!!management.unarchiveTarget}
				onOpenChange={(open) => {
					if (!open) management.setUnarchiveTarget(null);
				}}
				title={`Restore ${management.unarchiveTarget?.companyName ?? "partner"}?`}
				description="The organization returns to the partner roster. Portal access resumes for accepted partners with a current contract; otherwise it returns as awaiting activation or expired."
				confirmLabel={
					management.isUnarchiving ? "Restoring..." : "Restore partner"
				}
				confirmDisabled={management.isUnarchiving}
				onConfirm={management.confirmUnarchive}
			/>

			<ConfirmDialog
				open={!!management.jobDeleteTarget}
				onOpenChange={(open) => {
					if (!open) management.setJobDeleteTarget(null);
				}}
				title={`Archive ${management.jobDeleteTarget?.title ?? "job"}?`}
				description="The posting will leave the public job board while its audit history remains available."
				confirmLabel={management.isDeletingJob ? "Archiving..." : "Archive job"}
				confirmDisabled={management.isDeletingJob}
				destructive
				onConfirm={management.confirmDeleteJob}
			/>

			<ActivationLinkDialog
				activation={management.activation}
				onOpenChange={(open) => {
					if (!open) management.setActivation(null);
				}}
				onCopy={management.copyActivationLink}
			/>
		</ToolPageShell>
	);
}
