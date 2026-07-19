import { GlassCard } from "@/components/ui/GlassCard";
import { AdminDatabaseSkeleton } from "./components/AdminDatabaseSkeleton";
import { AdminDuplicateCandidatesPanel } from "./components/AdminDuplicateCandidatesPanel";
import { AdminFilterBar } from "./components/AdminFilterBar";
import { AdminMemberEditorDialog } from "./components/AdminMemberEditorDialog";
import { AdminMemberMergeDialog } from "./components/AdminMemberMergeDialog";
import { AdminMembersTable } from "./components/AdminMembersTable";
import { AdminWorkspaceHeader } from "./components/AdminWorkspaceHeader";
import { DepartmentPermissionsCard } from "./DepartmentPermissionsCard";
import { useAdminDatabase } from "./hooks/useAdminDatabase";
import { useAdminMemberEditor } from "./hooks/useAdminMemberEditor";
import { useAdminMemberMerge } from "./hooks/useAdminMemberMerge";

export { AdminDatabaseSkeleton };

export function AdminDatabaseView() {
	const {
		isLoading,
		error,
		filters,
		setFilters,
		sortBy,
		sortAsc,
		handleSortChange,
		filtered,
		stats,
		exportToCsv,
		exportToExcel,
		downloadEmails,
		memberLoadingMessage,
		updateMemberAsync,
		duplicateCandidates,
		duplicateCandidatesError,
		mergeMembersAsync,
		isMergingMembers,
		isSavingMember,
	} = useAdminDatabase();

	const editor = useAdminMemberEditor({ updateMemberAsync, isSavingMember });
	const merge = useAdminMemberMerge({ mergeMembersAsync, isMergingMembers });

	if (isLoading) return <AdminDatabaseSkeleton />;
	if (error)
		return (
			<div>
				<GlassCard variant="elevated">
					<div className="p-8 text-center">
						<p className="mb-1 font-bold text-destructive">
							Unable to load the admin workspace
						</p>
						<p className="text-muted-foreground">{error.message}</p>
					</div>
				</GlassCard>
			</div>
		);

	return (
		<div>
			<AdminWorkspaceHeader stats={stats} />

			<DepartmentPermissionsCard />

			<AdminFilterBar
				filters={filters}
				setFilters={setFilters}
				canExport={filtered.length > 0}
				onExportCsv={exportToCsv}
				onExportExcel={exportToExcel}
				onDownloadEmails={downloadEmails}
			/>

			<AdminDuplicateCandidatesPanel
				candidates={duplicateCandidates}
				error={duplicateCandidatesError}
				onOpenMerge={merge.openMergeDialog}
			/>

			<AdminMembersTable
				rows={filtered}
				sortBy={sortBy}
				sortAsc={sortAsc}
				onSortChange={handleSortChange}
				onEditMember={editor.openMemberEditor}
				loadingMessage={memberLoadingMessage}
			/>

			<AdminMemberEditorDialog {...editor} />
			<AdminMemberMergeDialog {...merge} />
		</div>
	);
}
