import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import {
	formatAmount,
	formatDate,
	getErrorMessage,
	getRequestTypeLabel,
	getStatusLabel,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";

interface ReimbursementRequestsSectionProps {
	isLoading: boolean;
	error: unknown;
	requests: ReimbursementRequest[];
	/** Opens the read-only detail view for one of the member's requests. */
	onSelectRequest: (request: ReimbursementRequest) => void;
}

function getRequestButtonLabel(request: ReimbursementRequest): string {
	return `View details for ${getRequestTypeLabel(request)} request from ${formatDate(
		request.date,
	)} (${formatAmount(request.amount)})`;
}

export function ReimbursementRequestsSection({
	isLoading,
	error,
	requests,
	onSelectRequest,
}: ReimbursementRequestsSectionProps): ReactElement {
	return (
		<GlassCard>
			<div className="p-5 md:p-6">
				<h2 className="mb-4 text-xl font-semibold">Existing requests</h2>

				{isLoading && (
					<SkeletonRegion
						label="Loading reimbursement requests"
						className="grid gap-3"
					>
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								key={i}
								className="min-w-0 rounded-lg bg-muted/50 p-4"
							>
								<div className="mb-2 flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1 space-y-1.5">
										<Skeleton className="h-5 w-40" />
										<Skeleton className="h-4 w-24" />
									</div>
									<Skeleton className="h-5 w-16" />
								</div>
								<div className="mb-2 flex gap-1.5">
									<Skeleton className="h-5 w-20 rounded-full" />
									<Skeleton className="h-5 w-16 rounded-full" />
								</div>
								<Skeleton className="h-4 w-3/4" />
							</div>
						))}
					</SkeletonRegion>
				)}

				{Boolean(error) && (
					<Alert variant="destructive">
						<AlertDescription>
							Error loading reimbursement requests: {getErrorMessage(error)}
						</AlertDescription>
					</Alert>
				)}

				{!isLoading && !error && requests.length === 0 && (
					<Alert>
						<AlertDescription>No reimbursement requests yet.</AlertDescription>
					</Alert>
				)}

				{!isLoading && !error && requests.length > 0 && (
					<ul className="grid gap-3">
						{requests.map((request) => (
							<li key={request.id} className="min-w-0">
								{/* Spans, not <p>: a <button> may only contain phrasing content. */}
								<button
									type="button"
									aria-haspopup="dialog"
									aria-label={getRequestButtonLabel(request)}
									onClick={() => onSelectRequest(request)}
									className="block w-full min-w-0 cursor-pointer rounded-lg bg-muted/50 p-4 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="mb-2 flex flex-wrap items-start justify-between gap-3">
										<span className="min-w-0 flex-[1_1_220px]">
											<span className="block font-bold break-words">
												{getRequestTypeLabel(request)} request
											</span>
											<span className="block text-sm text-muted-foreground">
												{formatDate(request.date)}
											</span>
										</span>
										<span className="font-bold whitespace-nowrap">
											{formatAmount(request.amount)}
										</span>
									</span>
									<span className="mb-2 flex flex-wrap gap-1.5">
										<Badge variant="outline">
											{getRequestTypeLabel(request)}
										</Badge>
										<Badge variant="neutral">{getStatusLabel(request)}</Badge>
									</span>
									<span className="mb-1 block text-sm break-words">
										{request.description}
									</span>
									{request.receipt_filename && (
										<span className="block text-sm break-words text-muted-foreground">
											{request.receipt_filename}
										</span>
									)}
									{request.rejection_reason && (
										<span className="mt-2 block text-sm break-words text-destructive">
											{request.rejection_reason}
										</span>
									)}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</GlassCard>
	);
}
