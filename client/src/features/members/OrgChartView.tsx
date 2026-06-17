import { Badge } from "@/components/ui/badge";
import type { Member } from "../../types";
import { OrgChartTeamCard, renderMembers } from "./orgChartShared";
import { buildOrgChart } from "./orgChartUtils";

interface OrgChartViewProps {
	members: Member[];
}

export function OrgChartView({
	members,
}: OrgChartViewProps): JSX.Element | null {
	const chart = buildOrgChart(members, [], []);
	const boardMemberCount =
		chart.board.presidents.length +
		chart.board.vicePresidents.length +
		chart.board.members.length;
	const hasBoard = boardMemberCount > 0;
	const hasDepartments = chart.departments.length > 0;

	if (!hasBoard && !hasDepartments) {
		return null;
	}

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">Org Chart</h1>
				<p className="mt-1 text-muted-foreground">
					Overview of current leadership and departments.
				</p>
			</div>

			{hasBoard && (
				<div className="mb-8 rounded-xl border bg-card p-6">
					<p className="mb-5 font-semibold">Board</p>
					<div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
						{chart.board.presidents.length > 0 && (
							<div>
								<p className="mb-2.5 text-xs font-medium text-muted-foreground">
									President
								</p>
								<div className="grid gap-3">
									{renderMembers(chart.board.presidents, { lead: true })}
								</div>
							</div>
						)}
						{chart.board.vicePresidents.length > 0 && (
							<div>
								<p className="mb-2.5 text-xs font-medium text-muted-foreground">
									Vice President
								</p>
								<div className="grid gap-3">
									{renderMembers(chart.board.vicePresidents, { lead: true })}
								</div>
							</div>
						)}
						{chart.board.members.length > 0 && (
							<div>
								<p className="mb-2.5 text-xs font-medium text-muted-foreground">
									Board Members
								</p>
								<div className="grid gap-3">
									{renderMembers(chart.board.members, { lead: true })}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{hasDepartments && (
				<div>
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="font-semibold">Departments</p>
						<Badge variant="outline">
							{`${chart.departments.length} department${chart.departments.length !== 1 ? "s" : ""}`}
						</Badge>
					</div>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{chart.departments.map((group) => (
							<OrgChartTeamCard
								key={group.department}
								title={group.department}
								count={group.teamLeads.length + group.members.length}
								primaryLabel="Team Leads"
								primaryMembers={group.teamLeads}
								primaryEmpty="No team lead assigned yet."
								secondaryLabel="Members"
								secondaryMembers={group.members}
								secondaryEmpty="No active members in this department."
								showBoardBadge
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
