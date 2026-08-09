import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnerJobsDialog } from "@/features/partnerManagement/components/PartnerJobsDialog";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import { AdminJobEditorDialog } from "./components/AdminJobEditorDialog";
import { AdminJobRequestCard } from "./components/AdminJobRequestCard";
import { AdminPartnerJobsPanel } from "./components/AdminPartnerJobsPanel";
import { useAdminJobRequests } from "./hooks/useAdminJobRequests";

export default function AdminJobRequestsPage() {
	const jobs = useAdminJobRequests();

	return (
		<AdminRequestsLayout
			title="Job Postings"
			description="Review submissions and manage member job postings."
			isLoading={jobs.isLoadingJobRequests}
			error={jobs.jobRequestsError}
			actions={
				<Button
					type="button"
					className="bg-[#9A64D9] text-white hover:bg-[#523573]"
					onClick={jobs.openCreate}
				>
					<Plus className="size-4" />
					Create standalone job
				</Button>
			}
		>
			<Tabs defaultValue="pending">
				<TabsList>
					<TabsTrigger value="pending">
						Pending ({jobs.pendingJobs.length})
					</TabsTrigger>
					<TabsTrigger value="managed">
						Managed ({jobs.managedJobs.length})
					</TabsTrigger>
					<TabsTrigger value="partner">Partner jobs</TabsTrigger>
				</TabsList>

				<TabsContent value="pending" className="pt-4">
					{jobs.pendingJobs.length === 0 ? (
						<GlassCard className="p-6">
							<p className="text-muted-foreground">
								No pending job posting requests.
							</p>
						</GlassCard>
					) : (
						<div className="grid gap-4 lg:grid-cols-2">
							{jobs.pendingJobs.map((request) => (
								<AdminJobRequestCard
									key={request.id}
									request={request}
									requesterName={jobs.requesterName(request)}
									isActionPending={jobs.actionIds.has(request.id)}
									onReview={(decision) => jobs.reviewJob(request.id, decision)}
									onEdit={
										request.source === "partner_portal"
											? undefined
											: () => jobs.openEdit(request)
									}
									onRemove={() => jobs.removeJob(request)}
								/>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="managed" className="pt-4">
					{jobs.managedJobs.length === 0 ? (
						<GlassCard className="p-6">
							<p className="text-muted-foreground">
								No managed job postings yet.
							</p>
						</GlassCard>
					) : (
						<div className="grid gap-4 lg:grid-cols-2">
							{jobs.managedJobs.map((request) => (
								<AdminJobRequestCard
									key={request.id}
									request={request}
									requesterName={jobs.requesterName(request)}
									isActionPending={jobs.actionIds.has(request.id)}
									onEdit={() => jobs.openEdit(request)}
									onRemove={() => jobs.removeJob(request)}
								/>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="partner" className="pt-4">
					<AdminPartnerJobsPanel
						partners={jobs.partnerManagement.allPartners}
						selectedPartnerId={jobs.selectedPartnerId}
						isLoading={jobs.partnerManagement.isLoading}
						error={jobs.partnerManagement.error}
						onPartnerChange={jobs.setSelectedPartnerId}
						onManageJobs={jobs.openSelectedPartnerJobs}
					/>
				</TabsContent>
			</Tabs>

			<AdminJobEditorDialog
				mode={jobs.editorMode}
				form={jobs.form}
				isSaving={jobs.isSavingJob}
				onClose={jobs.closeEditor}
				onSubmit={jobs.submitEditor}
			/>

			<PartnerJobsDialog
				partner={jobs.partnerManagement.jobsPartner}
				jobs={jobs.partnerManagement.jobs}
				isLoading={jobs.partnerManagement.jobsLoading}
				error={jobs.partnerManagement.jobsError}
				editorMode={jobs.partnerManagement.jobEditorMode}
				form={jobs.partnerManagement.jobForm}
				onOpenChange={(open) => {
					if (!open) jobs.partnerManagement.closeJobs();
				}}
				onCreate={jobs.partnerManagement.openCreateJob}
				onEdit={jobs.partnerManagement.openEditJob}
				onCancelEdit={jobs.partnerManagement.cancelJobEdit}
				onSubmit={jobs.partnerManagement.submitJobForm}
				onDelete={jobs.partnerManagement.setJobDeleteTarget}
				isSaving={jobs.partnerManagement.isSavingJob}
			/>

			<ConfirmDialog
				open={!!jobs.partnerManagement.jobDeleteTarget}
				onOpenChange={(open) => {
					if (!open) jobs.partnerManagement.setJobDeleteTarget(null);
				}}
				title={`Delete ${jobs.partnerManagement.jobDeleteTarget?.title ?? "job"}?`}
				description="The posting will be removed from the public job board. Its audit history will be retained."
				confirmLabel={
					jobs.partnerManagement.isDeletingJob ? "Deleting..." : "Delete job"
				}
				confirmDisabled={jobs.partnerManagement.isDeletingJob}
				destructive
				onConfirm={jobs.partnerManagement.confirmDeleteJob}
			/>
		</AdminRequestsLayout>
	);
}
