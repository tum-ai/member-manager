import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import { AdminJobEditorDialog } from "./components/AdminJobEditorDialog";
import { AdminJobRequestCard } from "./components/AdminJobRequestCard";
import { useAdminJobRequests } from "./hooks/useAdminJobRequests";

export default function AdminJobRequestsPage() {
	const jobs = useAdminJobRequests();

	return (
		<AdminRequestsLayout
			title="Job Postings"
			description="Review submissions and manage member job postings."
			isLoading={jobs.isLoading}
			error={jobs.error}
			actions={
				<Button
					type="button"
					className="bg-[#9A64D9] text-white hover:bg-[#523573]"
					onClick={jobs.openCreate}
				>
					<Plus className="size-4" />
					Create job
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
			</Tabs>

			<AdminJobEditorDialog
				mode={jobs.editorMode}
				form={jobs.form}
				isSaving={jobs.isSavingJob}
				onClose={jobs.closeEditor}
				onSubmit={jobs.submitEditor}
			/>
		</AdminRequestsLayout>
	);
}
