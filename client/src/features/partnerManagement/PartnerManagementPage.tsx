import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { ActivationLinkDialog } from "./components/ActivationLinkDialog";
import { PartnerDirectorySection } from "./components/PartnerDirectorySection";
import { PartnerFormDialog } from "./components/PartnerFormDialog";
import { usePartnerManagement } from "./hooks/usePartnerManagement";

export default function PartnerManagementPage(): React.ReactElement {
	const management = usePartnerManagement();

	return (
		<ToolPageShell
			title="Partner Management"
			description="Partner Portal accounts, contracts, and partnership tiers."
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
					totalCount={Object.values(management.statusCounts).reduce(
						(total, count) => total + count,
						0,
					)}
					searchTerm={management.searchTerm}
					onSearchTermChange={management.setSearchTerm}
					statusFilter={management.statusFilter}
					onStatusFilterChange={management.setStatusFilter}
					onCreate={management.openCreate}
					onEdit={management.openEdit}
					onActivationLink={management.generateActivationLink}
					onArchive={management.setArchiveTarget}
					isGeneratingActivationLink={management.isGeneratingActivationLink}
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
