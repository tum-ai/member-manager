import type { ReactElement } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { EducationalCourseApplicationsSection } from "./components/EducationalCourseApplicationsSection";
import { EducationalCourseCalendarSection } from "./components/EducationalCourseCalendarSection";
import { EducationalCourseParticipantRosterSection } from "./components/EducationalCourseParticipantRosterSection";
import { EducationalCoursePeriodForm } from "./components/EducationalCoursePeriodForm";
import { EducationalCoursePeriodsSection } from "./components/EducationalCoursePeriodsSection";
import { useEducationalCourses } from "./hooks/useEducationalCourses";

export default function EducationalCoursesPage(): ReactElement {
	const courses = useEducationalCourses();

	if (courses.isLoadingPeriods) {
		return (
			<ToolPageShell title="Educational Courses">
				<div className="grid grid-cols-1 gap-5 md:grid-cols-12">
					<Skeleton className="h-96 md:col-span-5" />
					<Skeleton className="h-96 md:col-span-7" />
				</div>
			</ToolPageShell>
		);
	}

	if (courses.periodsError) {
		return (
			<ToolPageShell title="Educational Courses">
				<Alert variant="destructive">
					<AlertTitle>Could not load educational courses</AlertTitle>
					<AlertDescription>{courses.periodsError.message}</AlertDescription>
				</Alert>
			</ToolPageShell>
		);
	}

	return (
		<ToolPageShell
			title="Educational Course Planning"
			description={
				courses.isAdministrator
					? "Publish course periods, manage the task force, and review applications."
					: "Review available periods and apply to teach an educational course."
			}
		>
			{courses.isAdministrator ? (
				<div className="space-y-6">
					<div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
						<div className="xl:col-span-7">
							<EducationalCoursePeriodForm
								periods={courses.periods}
								numberOfMonths={courses.isMobile ? 1 : 2}
								isCreating={courses.isCreatingPeriod}
								onSubmit={courses.createPeriod}
							/>
						</div>
						<div className="xl:col-span-5">
							<EducationalCourseParticipantRosterSection
								participants={courses.participants}
								eligibleMembers={courses.eligibleMembers}
								search={courses.participantSearch}
								isLoading={courses.isLoadingParticipants}
								isUpdating={courses.isUpdatingParticipant}
								onSearchChange={courses.setParticipantSearch}
								onSetParticipant={courses.setParticipant}
							/>
						</div>
					</div>

					<EducationalCoursePeriodsSection
						role={courses.role}
						periods={courses.periods}
						selectedPeriodId={courses.selectedPeriodId}
						isUpdatingPeriod={courses.isUpdatingPeriod}
						isDeletingPeriod={courses.isDeletingPeriod}
						isUpdatingApplication={courses.isUpdatingApplication}
						onSelectPeriod={courses.setSelectedPeriodId}
						onSetApplicationsOpen={courses.setApplicationsOpen}
						onDeletePeriod={courses.deletePeriod}
						onApply={courses.apply}
						onWithdraw={courses.withdraw}
					/>

					<EducationalCourseApplicationsSection
						detail={courses.selectedPeriodDetail}
						isLoading={courses.isLoadingPeriodDetail}
						isReviewing={courses.isReviewingApplication}
						onReview={courses.reviewApplication}
					/>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
					<div className="lg:col-span-5">
						<EducationalCourseCalendarSection
							periods={courses.periods}
							selectedPeriodId={courses.selectedPeriodId}
							numberOfMonths={courses.isMobile ? 1 : 2}
							onSelectPeriod={courses.setSelectedPeriodId}
						/>
					</div>
					<div className="lg:col-span-7">
						<EducationalCoursePeriodsSection
							role={courses.role}
							periods={courses.periods}
							selectedPeriodId={courses.selectedPeriodId}
							isUpdatingPeriod={courses.isUpdatingPeriod}
							isDeletingPeriod={courses.isDeletingPeriod}
							isUpdatingApplication={courses.isUpdatingApplication}
							onSelectPeriod={courses.setSelectedPeriodId}
							onSetApplicationsOpen={courses.setApplicationsOpen}
							onDeletePeriod={courses.deletePeriod}
							onApply={courses.apply}
							onWithdraw={courses.withdraw}
						/>
					</div>
				</div>
			)}
		</ToolPageShell>
	);
}
