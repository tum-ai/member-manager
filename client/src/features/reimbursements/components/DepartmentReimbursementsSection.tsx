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
import type { DepartmentReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";

interface DepartmentReimbursementsSectionProps {
	/** The member's department; `null` while loading or when they have none. */
	department: string | null;
	requests: DepartmentReimbursementRequest[];
	isLoading: boolean;
	error: unknown;
}

function getRequesterLabel(request: DepartmentReimbursementRequest): string {
	if (request.is_own) return "You";
	return request.requester_name ?? "Unknown member";
}

/**
 * Read-only list of everything submitted for the member's department, so two
 * members don't hand in the same invoice. Rows are summaries: receipts and
 * payment details stay with the requester and Legal & Finance.
 */
export function DepartmentReimbursementsSection({
	department,
	requests,
	isLoading,
	error,
}: DepartmentReimbursementsSectionProps): ReactElement | null {
	// A member without a department has no department list to show.
	if (!isLoading && !error && !department) {
		return null;
	}

	return (
		<GlassCard>
			<div className="p-5 md:p-6">
				<h2 className="text-xl font-semibold">
					{department ? `${department} requests` : "Department requests"}
				</h2>
				<p className="mt-1 mb-4 text-sm text-muted-foreground">
					Everything submitted for your department. Check here before you
					submit, so the same invoice isn't handed in twice. Receipts and
					payment details stay private.
				</p>

				{isLoading && (
					<SkeletonRegion
						label="Loading department requests"
						className="grid gap-4"
					>
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								key={i}
								className="flex items-start justify-between gap-4"
							>
								<div className="min-w-0 flex-1 space-y-1.5">
									<Skeleton className="h-5 w-2/3" />
									<Skeleton className="h-4 w-40" />
								</div>
								<Skeleton className="h-5 w-16" />
							</div>
						))}
					</SkeletonRegion>
				)}

				{Boolean(error) && (
					<Alert variant="destructive">
						<AlertDescription>
							Error loading department requests: {getErrorMessage(error)}
						</AlertDescription>
					</Alert>
				)}

				{!isLoading && !error && requests.length === 0 && (
					<Alert>
						<AlertDescription>
							No requests for your department yet.
						</AlertDescription>
					</Alert>
				)}

				{!isLoading && !error && requests.length > 0 && (
					<ul className="divide-y divide-border">
						{requests.map((request) => (
							<li
								key={request.id}
								className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
							>
								<div className="min-w-0 flex-[1_1_260px]">
									<p className="font-medium break-words">
										{request.description}
									</p>
									<p className="text-sm text-muted-foreground">
										{getRequesterLabel(request)} · {formatDate(request.date)}
									</p>
									<div className="mt-1.5 flex flex-wrap gap-1.5">
										<Badge variant="outline">
											{getRequestTypeLabel(request)}
										</Badge>
										<Badge variant="neutral">{getStatusLabel(request)}</Badge>
									</div>
								</div>
								<p className="font-bold whitespace-nowrap">
									{formatAmount(request.amount)}
								</p>
							</li>
						))}
					</ul>
				)}
			</div>
		</GlassCard>
	);
}
