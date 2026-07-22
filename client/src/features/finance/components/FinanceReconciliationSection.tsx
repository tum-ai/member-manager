import type {
	FinanceBudgetTransferRequest,
	FinanceBudgetTransferRequestCreate,
	FinancePlanItem,
	FinancePlanItemPostingMatchCreate,
	FinanceProject,
	FinanceReallocationRequest,
	FinanceReallocationRequestCreate,
	FinanceReconciliationPosting,
	FinanceReconciliationResponse,
} from "@member-manager/shared";
import { ListChecks, ReceiptText } from "lucide-react";
import type { ReactElement } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import type {
	BudgetTransferReviewInput,
	PostingAllocationInput,
	ProjectAllocationInput,
	ReallocationReviewInput,
} from "@/features/finance/hooks/useFinanceManagement";
import { FinanceBudgetTransferSection } from "./FinanceBudgetTransferSection";
import { FinanceManagementPeriodControls } from "./FinanceManagementPeriodControls";
import { FinanceReallocationQueue } from "./FinanceReallocationQueue";
import { FinanceReconciliationPostingRow } from "./FinanceReconciliationPostingRow";

const ALL_PROJECTS = "all";

export interface FinanceReconciliationSectionProps {
	period: FinancePeriod;
	projects: FinanceProject[];
	planItems: FinancePlanItem[];
	selectedProjectId: string | null;
	reconciliation?: FinanceReconciliationResponse;
	reallocationRequests: FinanceReallocationRequest[];
	budgetTransferRequests?: FinanceBudgetTransferRequest[];
	department: string | null;
	canManage: boolean;
	isLoading: boolean;
	error: Error | null;
	pendingAllocationExternalId: string | null;
	pendingReallocationExternalId: string | null;
	pendingMatchExternalId: string | null;
	deletingMatchId: string | null;
	reviewingRequestId: string | null;
	pendingBudgetTransfer?: boolean;
	reviewingBudgetTransferId?: string | null;
	onPeriodTypeChange: (type: FinanceProject["period_type"]) => void;
	onPeriodKeyChange: (key: string) => void;
	onProjectChange: (projectId: string | null) => void;
	onAllocateToProject: (input: ProjectAllocationInput) => Promise<void>;
	onSplitAllocation: (input: PostingAllocationInput) => Promise<void>;
	onCreateReallocation: (
		input: FinanceReallocationRequestCreate,
	) => Promise<void>;
	onReviewReallocation: (input: ReallocationReviewInput) => Promise<void>;
	onCreateBudgetTransfer?: (
		input: FinanceBudgetTransferRequestCreate,
	) => Promise<void>;
	onReviewBudgetTransfer?: (input: BudgetTransferReviewInput) => Promise<void>;
	onMatchPlanItem: (input: FinancePlanItemPostingMatchCreate) => Promise<void>;
	onDeleteMatch: (matchId: string) => Promise<void>;
}

export function FinanceReconciliationSection({
	period,
	projects,
	planItems,
	selectedProjectId,
	reconciliation,
	reallocationRequests,
	budgetTransferRequests = [],
	department,
	canManage,
	isLoading,
	error,
	pendingAllocationExternalId,
	pendingReallocationExternalId,
	pendingMatchExternalId,
	deletingMatchId,
	reviewingRequestId,
	pendingBudgetTransfer = false,
	reviewingBudgetTransferId = null,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onProjectChange,
	onAllocateToProject,
	onSplitAllocation,
	onCreateReallocation,
	onReviewReallocation,
	onCreateBudgetTransfer = async () => {},
	onReviewBudgetTransfer = async () => {},
	onMatchPlanItem,
	onDeleteMatch,
}: FinanceReconciliationSectionProps): ReactElement {
	const unmatched = reconciliation?.unmatched_postings ?? [];
	const unplanned = reconciliation?.unplanned_postings ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<FinanceManagementPeriodControls
					idPrefix="finance-reconciliation"
					period={period}
					onPeriodTypeChange={onPeriodTypeChange}
					onPeriodKeyChange={onPeriodKeyChange}
				/>
				<div className="grid gap-1.5">
					<Label htmlFor="finance-reconciliation-project">Projektfilter</Label>
					<Select
						value={selectedProjectId ?? ALL_PROJECTS}
						onValueChange={(value) =>
							onProjectChange(value === ALL_PROJECTS ? null : value)
						}
					>
						<SelectTrigger
							id="finance-reconciliation-project"
							className="w-64"
							aria-label="Projektfilter"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_PROJECTS}>Alle Projekte</SelectItem>
							{projects.map((project) => (
								<SelectItem key={project.id} value={project.id}>
									{project.name} · {project.department}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<Metric
					label="Nicht abgeglichen"
					value={unmatched.length}
					icon={<ListChecks className="size-4" />}
				/>
				<Metric
					label="Nicht geplant"
					value={unplanned.length}
					icon={<ReceiptText className="size-4" />}
				/>
				<Metric
					label="Offene Umverteilungen"
					value={
						reallocationRequests.filter(
							(request) => request.status === "pending",
						).length
					}
					icon={<ReceiptText className="size-4" />}
				/>
			</div>

			<section className="overflow-hidden rounded-md border bg-card shadow-sm">
				<Tabs defaultValue="unmatched">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
						<TabsList>
							<TabsTrigger value="unmatched">
								Nicht abgeglichen
								<Badge variant="neutral">{unmatched.length}</Badge>
							</TabsTrigger>
							<TabsTrigger value="unplanned">
								Nicht geplant
								<Badge variant="neutral">{unplanned.length}</Badge>
							</TabsTrigger>
						</TabsList>
						{reconciliation ? (
							<span className="text-xs text-muted-foreground">
								Quelle: {reconciliation.source === "real" ? "Live" : "Mock"}
							</span>
						) : null}
					</div>
					<TabsContent value="unmatched" className="mt-0">
						<PostingList
							rows={unmatched}
							isLoading={isLoading}
							{...{
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
							}}
						/>
					</TabsContent>
					<TabsContent value="unplanned" className="mt-0">
						<PostingList
							rows={unplanned}
							isLoading={isLoading}
							{...{
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
							}}
						/>
					</TabsContent>
				</Tabs>
			</section>

			<FinanceReallocationQueue
				requests={reallocationRequests}
				canManage={canManage}
				reviewingRequestId={reviewingRequestId}
				onReview={onReviewReallocation}
			/>
			<FinanceBudgetTransferSection
				period={period}
				requests={budgetTransferRequests}
				department={department}
				canManage={canManage}
				isSubmitting={pendingBudgetTransfer}
				reviewingRequestId={reviewingBudgetTransferId}
				onCreate={onCreateBudgetTransfer}
				onReview={onReviewBudgetTransfer}
			/>
		</div>
	);
}

function Metric({
	label,
	value,
	icon,
}: {
	label: string;
	value: number;
	icon: ReactElement;
}): ReactElement {
	return (
		<div className="flex items-center justify-between rounded-md border bg-card px-4 py-3 shadow-sm">
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-xl font-semibold tabular-nums">{value}</p>
			</div>
			<span className="rounded-md bg-brand/10 p-2 text-brand">{icon}</span>
		</div>
	);
}

function PostingList({
	rows,
	isLoading,
	...props
}: Omit<React.ComponentProps<typeof FinanceReconciliationPostingRow>, "row"> & {
	rows: FinanceReconciliationPosting[];
	isLoading: boolean;
}): ReactElement {
	if (isLoading) {
		return (
			<div className="p-4">
				<Skeleton className="h-56 w-full" />
			</div>
		);
	}
	if (rows.length === 0) {
		return (
			<p className="p-6 text-center text-sm text-muted-foreground">
				Keine offenen Buchungen in dieser Ansicht.
			</p>
		);
	}
	return (
		<Accordion type="multiple">
			{rows.map((row) => (
				<FinanceReconciliationPostingRow
					key={row.posting.external_id}
					row={row}
					{...props}
				/>
			))}
		</Accordion>
	);
}
