import type {
	FinanceBudgetTransferRequest,
	FinanceBudgetTransferRequestCreate,
	FinanceReallocationRequest,
} from "@member-manager/shared";
import { Inbox } from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FinanceBudgetTransferSection } from "@/features/finance/components/FinanceBudgetTransferSection";
import { FinanceManagementPeriodControls } from "@/features/finance/components/FinanceManagementPeriodControls";
import { FinanceReallocationQueue } from "@/features/finance/components/FinanceReallocationQueue";
import type { FinancePeriodType } from "@/features/finance/financeTypes";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import type {
	BudgetTransferReviewInput,
	ReallocationReviewInput,
} from "@/features/finance/hooks/useFinanceManagement";

interface FinanceApprovalsSectionProps {
	period: FinancePeriod;
	reallocationRequests: FinanceReallocationRequest[];
	budgetTransferRequests: FinanceBudgetTransferRequest[];
	department: string | null;
	canManage: boolean;
	error: Error | null;
	reviewingRequestId: string | null;
	pendingBudgetTransfer: boolean;
	reviewingBudgetTransferId: string | null;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
	onReviewReallocation: (input: ReallocationReviewInput) => Promise<void>;
	onCreateBudgetTransfer: (
		input: FinanceBudgetTransferRequestCreate,
	) => Promise<void>;
	onReviewBudgetTransfer: (input: BudgetTransferReviewInput) => Promise<void>;
}

// FR-O: the approval inbox, split out of the old Abgleich tab. Allocation and
// matching moved into the T-view, where the money is; what is left here is the
// queue of things one department asks another (or LnF) to approve — a different
// job, done by different people, at a different time.
export function FinanceApprovalsSection({
	period,
	reallocationRequests,
	budgetTransferRequests,
	department,
	canManage,
	error,
	reviewingRequestId,
	pendingBudgetTransfer,
	reviewingBudgetTransferId,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onReviewReallocation,
	onCreateBudgetTransfer,
	onReviewBudgetTransfer,
}: FinanceApprovalsSectionProps): ReactElement {
	const pendingReallocations = reallocationRequests.filter(
		(request) => request.status === "pending",
	).length;
	const pendingTransfers = budgetTransferRequests.filter(
		(request) => request.status === "pending",
	).length;
	const openCount = pendingReallocations + pendingTransfers;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<FinanceManagementPeriodControls
					idPrefix="finance-approvals"
					period={period}
					onPeriodTypeChange={onPeriodTypeChange}
					onPeriodKeyChange={onPeriodKeyChange}
				/>
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<Inbox className="size-4" aria-hidden />
					{openCount === 0 ? (
						"Keine offenen Anträge."
					) : (
						<>
							Offen
							<Badge variant="warning">{openCount}</Badge>
						</>
					)}
				</p>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

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
