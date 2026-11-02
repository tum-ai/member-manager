import type { McpAccessEntry } from "@member-manager/shared";
import { GlassCard } from "@/components/ui/GlassCard";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import { McpAccessCard } from "./components/McpAccessCard";
import { McpAccessConfirmDialog } from "./components/McpAccessConfirmDialog";
import { useAdminMcpAccess } from "./hooks/useAdminMcpAccess";

/**
 * `/admin/mcp-access`: who may use nomcp, the TUM.ai Notion MCP. Members show
 * up as pending the first time they connect an AI app.
 */
export default function AdminMcpAccessPage(): JSX.Element {
	const access = useAdminMcpAccess();

	const section = (
		title: string,
		entries: McpAccessEntry[],
		emptyText: string,
	) => (
		<section aria-label={title} className="space-y-3">
			<h2 className="text-lg font-semibold">
				{title} ({entries.length})
			</h2>
			{entries.length === 0 ? (
				<GlassCard className="p-6">
					<p className="text-muted-foreground">{emptyText}</p>
				</GlassCard>
			) : (
				<div className="grid items-start gap-4 lg:grid-cols-2">
					{entries.map((entry) => (
						<McpAccessCard
							key={`${entry.user_id}-${entry.status}-${entry.role ?? ""}`}
							entry={entry}
							isBusy={access.busyUserId === entry.user_id}
							onApprove={(role) => access.approve(entry, role)}
							onSetRole={(role) => access.setRole(entry, role)}
							onDeny={() => access.requestDeny(entry)}
							onRevoke={() => access.requestRevoke(entry)}
						/>
					))}
				</div>
			)}
		</section>
	);

	return (
		<AdminRequestsLayout
			title="Notion MCP access"
			description="Decide who can use the TUM.ai Notion MCP (nomcp) from their AI apps, as a reader or an editor. Members appear here when they first connect an app."
			isLoading={access.isLoading}
			error={access.error}
		>
			<div className="space-y-8">
				{section(
					"Waiting for approval",
					access.pending,
					"No requests are waiting.",
				)}
				{section("Approved", access.approved, "Nobody is approved yet.")}
				{section("Declined", access.denied, "Nobody was declined.")}
			</div>
			<McpAccessConfirmDialog
				confirmation={access.confirmation}
				onCancel={access.cancelConfirmation}
				onConfirm={access.confirm}
			/>
		</AdminRequestsLayout>
	);
}
