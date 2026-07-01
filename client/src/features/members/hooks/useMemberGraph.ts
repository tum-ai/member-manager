import {
	DEFAULT_MEMBER_GRAPH_REASON_KINDS,
	type MemberGraphReasonKind,
} from "@member-manager/shared";
import { useEffect, useMemo, useState } from "react";
import {
	buildMemberGraph,
	getDefaultSelectedNode,
	type MemberGraphData,
	type MemberGraphNode,
} from "@/features/members/memberGraphUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMembersListData } from "@/hooks/useMembersListData";

export interface UseMemberGraphResult {
	graph: MemberGraphData;
	isLoading: boolean;
	error: Error | null;
	reasonKinds: MemberGraphReasonKind[];
	setReasonKinds: (kinds: MemberGraphReasonKind[]) => void;
	showAlumni: boolean;
	setShowAlumni: (show: boolean) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	selectedNode: MemberGraphNode | null;
	compact: boolean;
	isolatedCount: number;
}

// Owns all member-graph state: which link reasons are active, alumni visibility,
// and the selected node. The graph itself is derived client-side from the shared
// members list — no dedicated graph endpoint.
export function useMemberGraph(): UseMemberGraphResult {
	const { members, isLoading, error } = useMembersListData();
	const isMobile = useIsMobile();
	const [reasonKinds, setReasonKindsState] = useState<MemberGraphReasonKind[]>([
		...DEFAULT_MEMBER_GRAPH_REASON_KINDS,
	]);
	const [showAlumni, setShowAlumni] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const graphMembers = useMemo(() => {
		return (members ?? []).filter((member) => {
			const status =
				member.member_status || (member.active ? "active" : "inactive");
			return showAlumni ? status !== "inactive" : status === "active";
		});
	}, [members, showAlumni]);

	const graph = useMemo(
		() => buildMemberGraph(graphMembers, { reasonKinds }),
		[graphMembers, reasonKinds],
	);

	// Default the inspector to the most-connected node, and clear the selection
	// if the current one drops out of the graph after a filter change.
	useEffect(() => {
		const defaultNode = getDefaultSelectedNode(graph);
		if (!selectedId && defaultNode) {
			setSelectedId(defaultNode.id);
			return;
		}
		if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) {
			setSelectedId(defaultNode?.id ?? null);
		}
	}, [graph, selectedId]);

	// Keep at least one reason enabled so the graph never goes blank.
	function setReasonKinds(next: MemberGraphReasonKind[]): void {
		if (next.length > 0) {
			setReasonKindsState(next);
		}
	}

	const selectedNode =
		graph.nodes.find((node) => node.id === selectedId) ?? null;
	const isolatedCount = graph.nodes.filter((node) => node.degree === 0).length;
	// Denser layouts (many nodes) or small screens use tighter physics + radii.
	const compact = graph.nodes.length > 120 || isMobile;

	return {
		graph,
		isLoading,
		error: error ?? null,
		reasonKinds,
		setReasonKinds,
		showAlumni,
		setShowAlumni,
		selectedId,
		setSelectedId,
		selectedNode,
		compact,
		isolatedCount,
	};
}
