import { type DateRange, DayPicker } from "@daypicker/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	type CreateEducationalCoursePeriodInput,
	createEducationalCoursePeriodSchema,
	type EducationalCoursePeriod,
	getEducationalCourseDateOnly,
} from "@member-manager/shared";
import "@daypicker/react/style.css";
import { CalendarPlus } from "lucide-react";
import type { CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	formatDateRange,
	parseDateOnly,
	serializeDateOnly,
} from "@/features/educationalCourses/educationalCoursesUtils";

interface EducationalCoursePeriodFormProps {
	periods: EducationalCoursePeriod[];
	numberOfMonths: number;
	isCreating: boolean;
	onSubmit: (input: CreateEducationalCoursePeriodInput) => Promise<void>;
}

const calendarStyle = {
	"--rdp-accent-color": "var(--brand)",
	"--rdp-accent-background-color":
		"color-mix(in srgb, var(--brand) 16%, transparent)",
} as CSSProperties;

export function EducationalCoursePeriodForm({
	periods,
	numberOfMonths,
	isCreating,
	onSubmit,
}: EducationalCoursePeriodFormProps) {
	const form = useForm<CreateEducationalCoursePeriodInput>({
		resolver: zodResolver(createEducationalCoursePeriodSchema),
		defaultValues: { startsOn: "", endsOn: "", capacity: 1 },
	});
	const startsOn = form.watch("startsOn");
	const endsOn = form.watch("endsOn");
	const dateRange: DateRange | undefined = startsOn
		? {
				from: parseDateOnly(startsOn),
				to: endsOn ? parseDateOnly(endsOn) : undefined,
			}
		: undefined;
	const earliestStartDate = parseDateOnly(getEducationalCourseDateOnly());
	earliestStartDate.setDate(earliestStartDate.getDate() + 1);
	const existingPeriodRanges = periods.map((period) => ({
		from: parseDateOnly(period.startsOn),
		to: parseDateOnly(period.endsOn),
	}));

	function setDateRange(range: DateRange | undefined): void {
		form.setValue(
			"startsOn",
			range?.from ? serializeDateOnly(range.from) : "",
			{ shouldDirty: true, shouldValidate: true },
		);
		form.setValue("endsOn", range?.to ? serializeDateOnly(range.to) : "", {
			shouldDirty: true,
			shouldValidate: true,
		});
	}

	async function submit(values: CreateEducationalCoursePeriodInput) {
		try {
			await onSubmit(values);
			form.reset({ startsOn: "", endsOn: "", capacity: 1 });
		} catch {
			// The mutation already presents its typed API error to the user.
		}
	}

	const schemaDateError =
		form.formState.errors.startsOn?.message ??
		form.formState.errors.endsOn?.message;
	const dateError =
		schemaDateError && (!startsOn || !endsOn)
			? "Select a start and end date."
			: schemaDateError;

	return (
		<GlassCard>
			<form
				onSubmit={form.handleSubmit(submit)}
				className="space-y-5 p-5 sm:p-6"
			>
				<input type="hidden" {...form.register("startsOn")} />
				<input type="hidden" {...form.register("endsOn")} />
				<div className="flex items-start gap-3">
					<div className="rounded-lg bg-brand/10 p-2 text-brand dark:bg-brand/15">
						<CalendarPlus className="size-5" aria-hidden="true" />
					</div>
					<div>
						<h2 className="font-semibold">Add course period</h2>
						<p className="text-sm text-muted-foreground">
							Select the inclusive date range and how many people may be
							approved. Existing periods cannot overlap.
						</p>
					</div>
				</div>

				<div className="overflow-x-auto">
					<DayPicker
						mode="range"
						aria-label="Select course period date range"
						selected={dateRange}
						onSelect={setDateRange}
						excludeDisabled
						numberOfMonths={numberOfMonths}
						pagedNavigation
						disabled={[{ before: earliestStartDate }, ...existingPeriodRanges]}
						modifiers={{
							existingPeriod: existingPeriodRanges,
						}}
						modifiersClassNames={{
							existingPeriod: "bg-muted font-medium text-muted-foreground",
						}}
						style={calendarStyle}
					/>
				</div>
				{dateError && (
					<p role="alert" className="text-sm text-destructive">
						{dateError}
					</p>
				)}

				{dateRange?.from && dateRange.to && (
					<p className="rounded-md bg-brand/10 px-3 py-2 text-sm font-medium text-foreground dark:bg-brand/15">
						Selected:{" "}
						{formatDateRange(
							serializeDateOnly(dateRange.from),
							serializeDateOnly(dateRange.to),
						)}
					</p>
				)}

				<div className="grid gap-1.5 sm:max-w-48">
					<Label htmlFor="educational-course-capacity">Approval capacity</Label>
					<Input
						id="educational-course-capacity"
						type="number"
						min={1}
						step={1}
						aria-invalid={Boolean(form.formState.errors.capacity)}
						aria-describedby={
							form.formState.errors.capacity
								? "educational-course-capacity-error"
								: undefined
						}
						{...form.register("capacity", { valueAsNumber: true })}
					/>
					{form.formState.errors.capacity?.message && (
						<p
							id="educational-course-capacity-error"
							role="alert"
							className="text-sm text-destructive"
						>
							{form.formState.errors.capacity.message}
						</p>
					)}
				</div>

				<Button
					type="submit"
					disabled={isCreating || form.formState.isSubmitting}
				>
					{isCreating ? "Creating..." : "Create open period"}
				</Button>
			</form>
		</GlassCard>
	);
}
