import { TriangleAlert } from "lucide-react";
import { InfoBox } from "@/components/ui/info-box";
import { AdminRequestsBody } from "@/features/admin/AdminRequestsLayout";
import { AccessSection } from "@/features/admin/components/AccessSection";
import { DevMcpAccessCard } from "@/features/admin/components/DevMcpAccessCard";
import { DevMcpAccessConfirmDialog } from "@/features/admin/components/DevMcpAccessConfirmDialog";
import { DevMcpToolsDialog } from "@/features/admin/components/DevMcpToolsDialog";
import type { AdminDevMcpAccess } from "@/features/admin/hooks/useAdminDevMcpAccess";

/**
 * The Dev tab of /admin/mcp-access: who may use dev-mcp (Dev Claude and
 * directly connected AI apps), with which role and tools. Members show up
 * when they ask Dev Claude for access or first connect an AI app.
 */
export function DevMcpAccessPanel({
	access,
}: {
	access: AdminDevMcpAccess;
}): JSX.Element {
	const destructiveTools = new Set(
		access.catalog.filter((tool) => tool.destructive).map((tool) => tool.name),
	);
	const sections = [
		["Waiting for approval", access.requested, "No requests are waiting."],
		["Active", access.active, "Nobody has access yet."],
		["Suspended", access.suspended, "Nobody is suspended."],
		["Declined", access.denied, "Nobody was declined."],
	] as const;

	return (
		<AdminRequestsBody isLoading={access.isLoading} error={access.error}>
			{access.catalogError ? (
				<InfoBox
					variant="destructive"
					className="mb-6 flex gap-3 p-4 text-sm"
					role="alert"
				>
					<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
					<p>
						Dev MCP's tool list can't be loaded ({access.catalogError.message}).
						Approving and changing roles or tools need it; suspending and
						denying still work.
					</p>
				</InfoBox>
			) : null}
			<div className="space-y-8">
				{sections.map(([title, entries, emptyText]) => (
					<AccessSection
						key={title}
						title={title}
						entries={entries}
						emptyText={emptyText}
						renderEntry={(entry) => (
							<DevMcpAccessCard
								key={`${entry.user_id}-${entry.status}-${entry.role ?? ""}`}
								entry={entry}
								isBusy={access.busyUserId === entry.user_id}
								destructiveTools={destructiveTools}
								onApprove={(role) => access.approve(entry, role)}
								onSetRole={(role) => access.setRole(entry, role)}
								onEditTools={() => access.editTools(entry)}
								onSuspend={() => access.requestSuspend(entry)}
								onDeny={() => access.requestDeny(entry)}
							/>
						)}
					/>
				))}
			</div>
			<DevMcpAccessConfirmDialog
				confirmation={access.confirmation}
				onCancel={access.cancelConfirmation}
				onConfirm={access.confirm}
			/>
			<DevMcpToolsDialog
				entry={access.editingTools}
				catalog={access.catalog}
				onCancel={access.cancelEditTools}
				onSave={access.saveTools}
			/>
		</AdminRequestsBody>
	);
}
