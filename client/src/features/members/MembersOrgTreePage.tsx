import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useMembersListData } from "../../hooks/useMembersListData";
import OrgChartDiagram from "./orgTree/OrgChartDiagram";
import { buildOrgTree } from "./orgTree/orgTreeData";

export default function MembersOrgTreePage() {
	const { members, isLoading, error } = useMembersListData();

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

	const nodes = buildOrgTree(members ?? []);

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">Org Tree</h1>
				<p className="mt-1 text-muted-foreground">
					Interactive hierarchy of the board, departments, and their co-leads.
					Click a department to reveal its members.
				</p>
			</div>
			<OrgChartDiagram nodes={nodes} />
		</div>
	);
}
