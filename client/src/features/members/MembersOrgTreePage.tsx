import { Spinner } from "@/components/ui/spinner";
import { useMembersListData } from "../../hooks/useMembersListData";
import OrgChartDiagram from "./orgTree/OrgChartDiagram";
import { buildOrgTree } from "./orgTree/orgTreeData";

export default function MembersOrgTreePage() {
	const { members, isLoading, error } = useMembersListData();

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center gap-4">
				<Spinner className="size-6" />
				<p className="text-muted-foreground">Loading org tree...</p>
			</div>
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
