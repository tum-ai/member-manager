import { AdminRequestsBody } from "@/features/admin/AdminRequestsLayout";
import { AccessSection } from "@/features/admin/components/AccessSection";
import { McpAccessCard } from "@/features/admin/components/McpAccessCard";
import { McpAccessConfirmDialog } from "@/features/admin/components/McpAccessConfirmDialog";
import type { useAdminMcpAccess } from "@/features/admin/hooks/useAdminMcpAccess";

/**
 * The Notion tab of /admin/mcp-access: who may use nomcp, the TUM.ai Notion
 * MCP. Members show up as pending the first time they connect an AI app.
 */
export function NotionMcpAccessPanel({
	access,
}: {
	access: ReturnType<typeof useAdminMcpAccess>;
}): JSX.Element {
	return (
		<AdminRequestsBody isLoading={access.isLoading} error={access.error}>
			<div className="space-y-8">
				{(
					[
						[
							"Waiting for approval",
							access.pending,
							"No requests are waiting.",
						],
						["Approved", access.approved, "Nobody is approved yet."],
						["Declined", access.denied, "Nobody was declined."],
					] as const
				).map(([title, entries, emptyText]) => (
					<AccessSection
						key={title}
						title={title}
						entries={entries}
						emptyText={emptyText}
						renderEntry={(entry) => (
							<McpAccessCard
								key={`${entry.user_id}-${entry.status}-${entry.role ?? ""}`}
								entry={entry}
								isBusy={access.busyUserId === entry.user_id}
								onApprove={(role) => access.approve(entry, role)}
								onSetRole={(role) => access.setRole(entry, role)}
								onDeny={() => access.requestDeny(entry)}
								onRevoke={() => access.requestRevoke(entry)}
							/>
						)}
					/>
				))}
			</div>
			<McpAccessConfirmDialog
				confirmation={access.confirmation}
				onCancel={access.cancelConfirmation}
				onConfirm={access.confirm}
			/>
		</AdminRequestsBody>
	);
}
