import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMembersListData } from "@/hooks/useMembersListData";
import { isActiveMember } from "@/lib/memberMetadata";
import { OrgChartDiagram } from "./orgTree/OrgChartDiagram";
import { buildOrgTree } from "./orgTree/orgTreeData";

export default function MembersOrgTreePage() {
	useSetPageHeader(
		"Org Tree",
		"Interactive hierarchy of the board, departments, and their co-leads. Click a department to reveal its members.",
	);
	const isMobile = useIsMobile();
	const { members, isLoading, error } = useMembersListData();

	// Org Tree is desktop-only; redirect mobile (incl. deep links) to Org Chart.
	if (isMobile) {
		return <Navigate to="/members/org-chart" replace />;
	}

	if (isLoading) {
		return (
			<SkeletonRegion label="Loading org tree">
				<div className="mb-6 space-y-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-[34rem] max-w-full" />
				</div>
				<Skeleton className="h-[60vh] w-full rounded-xl" />
			</SkeletonRegion>
		);
	}

	if (error) {
		return (
			<div className="py-16 text-center">
				<p className="text-destructive">
					Failed to load members. Please try again later.
				</p>
			</div>
		);
	}

	// Alumni and inactive members are excluded from the org tree.
	const nodes = buildOrgTree((members ?? []).filter(isActiveMember));

	return (
		<div>
			<OrgChartDiagram nodes={nodes} />
		</div>
	);
}
