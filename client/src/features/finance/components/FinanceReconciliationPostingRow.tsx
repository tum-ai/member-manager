import type {
	FinancePlanItem,
	FinancePlanItemPostingMatchCreate,
	FinanceProject,
	FinanceReallocationRequestCreate,
	FinanceReconciliationPosting,
} from "@member-manager/shared";
import { Loader2, Trash2 } from "lucide-react";
import type { ReactElement } from "react";
import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	formatBereichLabel,
	formatFinanceAmount,
	formatFinanceDate,
} from "@/features/finance/financeUtils";
import type {
	PostingAllocationInput,
	ProjectAllocationInput,
} from "@/features/finance/hooks/useFinanceManagement";
import { FinanceAllocationEditor } from "./FinanceAllocationEditor";
import { FinancePlanMatchForm } from "./FinancePlanMatchForm";
import { FinanceReallocationForm } from "./FinanceReallocationForm";

interface FinanceReconciliationPostingRowProps {
	row: FinanceReconciliationPosting;
	projects: FinanceProject[];
	planItems: FinancePlanItem[];
	department: string | null;
	canManage: boolean;
	pendingAllocationExternalId: string | null;
	pendingReallocationExternalId: string | null;
	pendingMatchExternalId: string | null;
	deletingMatchId: string | null;
	onAllocateToProject: (input: ProjectAllocationInput) => Promise<void>;
	onSplitAllocation: (input: PostingAllocationInput) => Promise<void>;
	onCreateReallocation: (
		input: FinanceReallocationRequestCreate,
	) => Promise<void>;
	onMatchPlanItem: (input: FinancePlanItemPostingMatchCreate) => Promise<void>;
	onDeleteMatch: (matchId: string) => Promise<void>;
}

export function FinanceReconciliationPostingRow({
	row,
	projects,
	planItems,
	department,
	canManage,
	pendingAllocationExternalId,
	pendingReallocationExternalId,
	pendingMatchExternalId,
	deletingMatchId,
	onAllocateToProject,
	onSplitAllocation,
	onCreateReallocation,
	onMatchPlanItem,
	onDeleteMatch,
}: FinanceReconciliationPostingRowProps): ReactElement {
	const itemNames = new Map(planItems.map((item) => [item.id, item.label]));
	const posting = row.posting;
	const isOvermatched = row.overmatched_amount > 0;

	return (
		<AccordionItem value={posting.external_id}>
			<AccordionTrigger className="px-3 hover:no-underline">
				<span className="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 text-left md:grid-cols-[7rem_minmax(12rem,1fr)_8rem_8rem]">
					<span className="text-xs text-muted-foreground">
						{formatFinanceDate(posting.date)}
					</span>
					<span className="min-w-0">
						<span className="block truncate font-medium">
							{posting.postingtext}
						</span>
						<span className="block truncate text-xs font-normal text-muted-foreground">
							{posting.transaction_purpose}
						</span>
					</span>
					<span className="text-right tabular-nums">
						{formatFinanceAmount(row.scope_amount)}
					</span>
					<Badge
						variant={
							isOvermatched
								? "danger"
								: row.unmatched_amount > 0
									? "warning"
									: "success"
						}
						className="justify-self-start md:justify-self-end"
					>
						{isOvermatched ? (
							<>Overmatched {formatFinanceAmount(row.overmatched_amount)}</>
						) : (
							<>Open {formatFinanceAmount(row.unmatched_amount)}</>
						)}
					</Badge>
				</span>
			</AccordionTrigger>
			<AccordionContent className="grid gap-4 px-3">
				<div className="grid gap-2 lg:grid-cols-2">
					<div className="rounded-md bg-muted/40 p-3">
						<h4 className="text-xs font-semibold uppercase text-muted-foreground">
							Current allocation
						</h4>
						{row.allocations.length === 0 ? (
							<p className="mt-2 text-sm text-muted-foreground">
								Automatic allocation from the cost location.
							</p>
						) : (
							<ul className="mt-2 grid gap-1 text-sm">
								{row.allocations.map((allocation) => (
									<li
										key={allocation.id}
										className="flex flex-wrap justify-between gap-2"
									>
										<span>
											{allocation.department ?? "No department"} ·{" "}
											{formatBereichLabel(allocation.tax_area)}
										</span>
										<span className="tabular-nums">
											{allocation.allocated_percentage.toLocaleString("de-DE")}{" "}
											% · {formatFinanceAmount(allocation.allocated_amount)}
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
					<div className="rounded-md bg-muted/40 p-3">
						<h4 className="text-xs font-semibold uppercase text-muted-foreground">
							Plan matching
						</h4>
						{row.matches.length === 0 ? (
							<p className="mt-2 text-sm text-muted-foreground">
								No plan item linked yet.
							</p>
						) : (
							<ul className="mt-2 grid gap-1">
								{row.matches.map((match) => (
									<li
										key={match.id}
										className="flex items-center justify-between gap-2 text-sm"
									>
										<span className="min-w-0 truncate">
											{itemNames.get(match.plan_item_id) ?? "Plan item"} ·{" "}
											{formatFinanceAmount(match.matched_amount)}
										</span>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											disabled={deletingMatchId === match.id}
											aria-label={`Remove plan match ${itemNames.get(match.plan_item_id) ?? match.id}`}
											onClick={() => {
												void onDeleteMatch(match.id);
											}}
										>
											{deletingMatchId === match.id ? (
												<Loader2 className="animate-spin" />
											) : (
												<Trash2 />
											)}
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>

				{isOvermatched ? (
					<p
						role="alert"
						className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						The matched plan amount exceeds this posting share by{" "}
						{formatFinanceAmount(row.overmatched_amount)}. Remove an existing
						match first.
					</p>
				) : (
					<FinancePlanMatchForm
						postingExternalId={posting.external_id}
						unmatchedAmount={row.unmatched_amount}
						planItems={planItems}
						isPending={pendingMatchExternalId === posting.external_id}
						onSubmit={onMatchPlanItem}
					/>
				)}

				{canManage ? (
					<FinanceAllocationEditor
						postingExternalId={posting.external_id}
						projects={projects}
						department={department}
						isPending={pendingAllocationExternalId === posting.external_id}
						onAllocateToProject={onAllocateToProject}
						onSplitAllocation={onSplitAllocation}
					/>
				) : (
					<FinanceReallocationForm
						postingExternalId={posting.external_id}
						projects={projects}
						department={department}
						isPending={pendingReallocationExternalId === posting.external_id}
						onSubmit={onCreateReallocation}
					/>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}
