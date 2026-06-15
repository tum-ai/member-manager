import { Spinner } from "@/components/ui/spinner";
import { useMembersListData } from "../../hooks/useMembersListData";
import OrgChartView from "./OrgChartView";

export default function MembersOrgChartPage() {
	const { members, isLoading, error } = useMembersListData();

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center gap-4">
				<Spinner className="size-6" />
				<p className="text-muted-foreground">Loading org chart...</p>
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

	return <OrgChartView members={members ?? []} />;
}
