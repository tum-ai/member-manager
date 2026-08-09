import type { EducationalCoursePeriodDetail } from "@member-manager/shared";
import { Check, ClipboardList, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRange } from "@/features/educationalCourses/educationalCoursesUtils";

interface EducationalCourseApplicationsSectionProps {
	detail: EducationalCoursePeriodDetail | null;
	isLoading: boolean;
	isReviewing: boolean;
	onReview: (
		applicationId: string,
		periodId: string,
		decision: "approved" | "rejected",
	) => void;
}

export function EducationalCourseApplicationsSection({
	detail,
	isLoading,
	isReviewing,
	onReview,
}: EducationalCourseApplicationsSectionProps) {
	const applications = detail
		? [...detail.applications].sort((left, right) => {
				if (left.status === right.status)
					return left.createdAt.localeCompare(right.createdAt);
				if (left.status === "pending") return -1;
				if (right.status === "pending") return 1;
				return left.status.localeCompare(right.status);
			})
		: [];

	return (
		<GlassCard
			role="region"
			aria-labelledby="educational-course-application-review-heading"
		>
			<div className="space-y-4 p-5 sm:p-6">
				<div className="flex items-start gap-3">
					<div className="rounded-lg bg-brand/10 p-2 text-brand dark:bg-brand/15">
						<ClipboardList className="size-5" aria-hidden="true" />
					</div>
					<div>
						<h2
							id="educational-course-application-review-heading"
							className="font-semibold"
						>
							Application review
						</h2>
						<p className="text-sm text-muted-foreground">
							{detail
								? formatDateRange(detail.period.startsOn, detail.period.endsOn)
								: "Select a period to review its applications."}
						</p>
					</div>
				</div>

				{isLoading ? (
					<div
						className="space-y-3"
						role="status"
						aria-label="Loading applications"
					>
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				) : !detail ? (
					<p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
						Choose a course period from the list.
					</p>
				) : applications.length === 0 ? (
					<p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
						No one has applied for this period.
					</p>
				) : (
					<ul className="space-y-2">
						{applications.map((application) => (
							<li
								key={application.id}
								className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<p className="font-medium">
										{application.givenName} {application.surname}
									</p>
									<Badge
										variant={
											application.status === "approved"
												? "success"
												: application.status === "rejected"
													? "danger"
													: "warning"
										}
										className="mt-1"
									>
										{application.status === "pending"
											? "Pending review"
											: application.status === "approved"
												? "Approved"
												: "Rejected"}
									</Badge>
								</div>
								<div className="flex gap-2">
									{application.status !== "approved" && (
										<Button
											type="button"
											size="sm"
											disabled={isReviewing}
											onClick={() =>
												onReview(
													application.id,
													application.periodId,
													"approved",
												)
											}
										>
											<Check className="size-4" aria-hidden="true" />
											Approve
										</Button>
									)}
									{application.status !== "rejected" && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={isReviewing}
											onClick={() =>
												onReview(
													application.id,
													application.periodId,
													"rejected",
												)
											}
										>
											<X className="size-4" aria-hidden="true" />
											Reject
										</Button>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</GlassCard>
	);
}
