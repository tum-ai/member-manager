import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	getHoverConnections,
	getInitials,
	getReasonSummary,
	type MemberGraphData,
	type MemberGraphNode,
} from "@/features/members/memberGraphUtils";

interface MemberGraphInspectorProps {
	graph: MemberGraphData;
	selectedNode: MemberGraphNode | null;
	onSelectNode: (nodeId: string) => void;
}

export function MemberGraphInspector({
	graph,
	selectedNode,
	onSelectNode,
}: MemberGraphInspectorProps): React.ReactElement {
	if (!selectedNode) {
		return (
			<div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
				Select a member — click a node or a search result — to see how they
				connect.
			</div>
		);
	}

	const connections = getHoverConnections(graph, selectedNode.id);
	const linkedin = selectedNode.member.linkedin_profile_url;

	return (
		<div className="rounded-xl border bg-card p-4" aria-live="polite">
			<div className="flex items-start gap-3">
				<Avatar size="lg">
					<AvatarFallback>{getInitials(selectedNode.member)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<p className="font-bold">{selectedNode.label}</p>
					{selectedNode.subtitle && (
						<p className="truncate text-sm text-muted-foreground">
							{selectedNode.subtitle}
						</p>
					)}
					{linkedin && (
						<a
							href={linkedin}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-brand underline underline-offset-2"
						>
							LinkedIn
						</a>
					)}
				</div>
			</div>

			<div className="mt-3 flex flex-wrap gap-1.5">
				<Badge variant="neutral">Cluster {selectedNode.componentId}</Badge>
				<Badge variant="neutral">{selectedNode.componentSize} members</Badge>
				<Badge variant="neutral">{selectedNode.degree} links</Badge>
			</div>

			<p className="mt-4 mb-1.5 text-xs text-muted-foreground">Grouped with</p>
			{connections.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No shown link for the selected attributes.
				</p>
			) : (
				<ul className="space-y-1">
					{connections.slice(0, 8).map(({ neighbor, edge }) => (
						<li key={edge.id}>
							<button
								type="button"
								onClick={() => onSelectNode(neighbor.id)}
								className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								<span className="block text-sm font-semibold">
									{neighbor.label}
								</span>
								<span className="block text-xs text-muted-foreground">
									{getReasonSummary(edge)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
