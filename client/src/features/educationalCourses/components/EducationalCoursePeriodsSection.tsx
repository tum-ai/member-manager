import type {
	EducationalCoursePeriod,
	EducationalCourseRole,
} from "@member-manager/shared";
import { CheckCircle2, Lock, Send, Trash2, Undo2, Users } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import {
	applicationStatusLabel,
	formatDateRange,
	getPeriodState,
} from "@/features/educationalCourses/educationalCoursesUtils";
import { cn } from "@/lib/utils";

interface EducationalCoursePeriodsSectionProps {
	role: EducationalCourseRole | null;
	periods: EducationalCoursePeriod[];
	selectedPeriodId: string | null;
	isUpdatingPeriod: boolean;
	isDeletingPeriod: boolean;
	isUpdatingApplication: boolean;
	onSelectPeriod: (periodId: string) => void;
	onSetApplicationsOpen: (periodId: string, applicationsOpen: boolean) => void;
	onDeletePeriod: (periodId: string) => void;
	onApply: (periodId: string) => void;
	onWithdraw: (periodId: string) => void;
}

function periodBadge(state: "open" | "closed" | "in_progress" | "past"): {
	label: string;
	variant: BadgeVariant;
} {
	if (state === "open")
		return { label: "Applications open", variant: "success" };
	if (state === "past") return { label: "Past", variant: "neutral" };
	if (state === "in_progress")
		return { label: "In progress", variant: "neutral" };
	return { label: "Applications closed", variant: "warning" };
}

export function EducationalCoursePeriodsSection({
	role,
	periods,
	selectedPeriodId,
	isUpdatingPeriod,
	isDeletingPeriod,
	isUpdatingApplication,
	onSelectPeriod,
	onSetApplicationsOpen,
	onDeletePeriod,
	onApply,
	onWithdraw,
}: EducationalCoursePeriodsSectionProps) {
	const sortedPeriods = [...periods].sort((left, right) =>
		left.startsOn.localeCompare(right.startsOn),
	);

	return (
		<section aria-labelledby="course-periods-heading" className="space-y-3">
			<div>
				<h2 id="course-periods-heading" className="text-lg font-semibold">
					Course periods
				</h2>
				<p className="text-sm text-muted-foreground">
					Applications are reviewed separately for every period.
				</p>
			</div>
			{sortedPeriods.length === 0 ? (
				<GlassCard>
					<p className="p-8 text-center text-sm text-muted-foreground">
						No educational course periods are available.
					</p>
				</GlassCard>
			) : (
				<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
					{sortedPeriods.map((period) => {
						const state = getPeriodState(period);
						const badge = periodBadge(state);
						const application = period.myApplication;
						const isSelected = selectedPeriodId === period.id;
						return (
							<GlassCard
								key={period.id}
								className={cn(
									"transition-shadow",
									isSelected && "ring-2 ring-brand/35",
								)}
							>
								<div className="space-y-4 p-5">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<p className="font-semibold">
												{formatDateRange(period.startsOn, period.endsOn)}
											</p>
											<div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
												<Users className="size-4" aria-hidden="true" />
												{period.approvedParticipants.length} of{" "}
												{period.capacity} approved
											</div>
										</div>
										<Badge variant={badge.variant}>{badge.label}</Badge>
									</div>

									<div>
										<p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
											Approved participants
										</p>
										{period.approvedParticipants.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												No approvals yet.
											</p>
										) : (
											<ul className="flex flex-wrap gap-2">
												{period.approvedParticipants.map((participant) => (
													<li key={participant.userId}>
														<Badge variant="accent">
															{participant.displayName}
														</Badge>
													</li>
												))}
											</ul>
										)}
									</div>

									{role === "participant" && (
										<div className="flex flex-wrap items-center gap-2 border-t pt-3">
											{application ? (
												<Badge
													variant={
														application.status === "approved"
															? "success"
															: application.status === "rejected"
																? "danger"
																: "warning"
													}
												>
													{applicationStatusLabel(application.status)}
												</Badge>
											) : (
												<span className="text-sm text-muted-foreground">
													Not applied
												</span>
											)}
											{!application && state === "open" && (
												<Button
													type="button"
													size="sm"
													disabled={isUpdatingApplication}
													onClick={() => onApply(period.id)}
												>
													<Send className="size-4" aria-hidden="true" />
													Apply
												</Button>
											)}
											{application?.status === "pending" && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={isUpdatingApplication}
													onClick={() => onWithdraw(period.id)}
												>
													<Undo2 className="size-4" aria-hidden="true" />
													Withdraw
												</Button>
											)}
										</div>
									)}

									{role === "administrator" && (
										<div className="flex flex-wrap gap-2 border-t pt-3">
											<Button
												type="button"
												size="sm"
												variant={isSelected ? "secondary" : "default"}
												onClick={() => onSelectPeriod(period.id)}
											>
												<CheckCircle2 className="size-4" aria-hidden="true" />
												Review applications
											</Button>
											{(state === "open" || state === "closed") && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={isUpdatingPeriod}
													onClick={() =>
														onSetApplicationsOpen(
															period.id,
															!period.applicationsOpen,
														)
													}
												>
													<Lock className="size-4" aria-hidden="true" />
													{period.applicationsOpen ? "Close" : "Reopen"}
												</Button>
											)}
											<Button
												type="button"
												variant="ghost"
												size="sm"
												disabled={isDeletingPeriod}
												onClick={() => onDeletePeriod(period.id)}
												className="text-destructive hover:text-destructive"
											>
												<Trash2 className="size-4" aria-hidden="true" />
												Delete
											</Button>
										</div>
									)}
								</div>
							</GlassCard>
						);
					})}
				</div>
			)}
		</section>
	);
}
