import { DayPicker } from "@daypicker/react";
import type { EducationalCoursePeriod } from "@member-manager/shared";
import "@daypicker/react/style.css";
import { CalendarDays } from "lucide-react";
import type { CSSProperties } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
	isDateWithinPeriod,
	parseDateOnly,
} from "@/features/educationalCourses/educationalCoursesUtils";

interface EducationalCourseCalendarSectionProps {
	periods: EducationalCoursePeriod[];
	selectedPeriodId: string | null;
	numberOfMonths: number;
	onSelectPeriod: (periodId: string) => void;
}

const calendarStyle = {
	"--rdp-accent-color": "var(--brand)",
	"--rdp-accent-background-color":
		"color-mix(in srgb, var(--brand) 16%, transparent)",
} as CSSProperties;

export function EducationalCourseCalendarSection({
	periods,
	selectedPeriodId,
	numberOfMonths,
	onSelectPeriod,
}: EducationalCourseCalendarSectionProps) {
	const selectedPeriod = periods.find(
		(period) => period.id === selectedPeriodId,
	);
	const periodRanges = periods.map((period) => ({
		from: parseDateOnly(period.startsOn),
		to: parseDateOnly(period.endsOn),
	}));

	return (
		<GlassCard>
			<div className="p-5 sm:p-6">
				<div className="mb-4 flex items-start gap-3">
					<div className="rounded-lg bg-brand/10 p-2 text-brand dark:bg-brand/15">
						<CalendarDays className="size-5" aria-hidden="true" />
					</div>
					<div>
						<h2 className="font-semibold">Available course periods</h2>
						<p className="text-sm text-muted-foreground">
							Choose a highlighted date to inspect its course period.
						</p>
					</div>
				</div>
				{periods.length === 0 ? (
					<p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
						No course periods have been published yet.
					</p>
				) : (
					<div className="overflow-x-auto">
						<DayPicker
							aria-label="Educational course periods"
							numberOfMonths={numberOfMonths}
							pagedNavigation
							defaultMonth={parseDateOnly(periods[0].startsOn)}
							selected={
								selectedPeriod
									? {
											from: parseDateOnly(selectedPeriod.startsOn),
											to: parseDateOnly(selectedPeriod.endsOn),
										}
									: undefined
							}
							modifiers={{ coursePeriod: periodRanges }}
							modifiersClassNames={{
								coursePeriod:
									"bg-brand/10 font-semibold text-foreground dark:bg-brand/20",
							}}
							onDayClick={(date) => {
								const period = periods.find((entry) =>
									isDateWithinPeriod(date, entry),
								);
								if (period) onSelectPeriod(period.id);
							}}
							style={calendarStyle}
						/>
					</div>
				)}
			</div>
		</GlassCard>
	);
}
