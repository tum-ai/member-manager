import {
	type EducationalCourseApplicationStatus,
	type EducationalCoursePeriod,
	getEducationalCourseDateOnly,
} from "@member-manager/shared";

export function parseDateOnly(value: string): Date {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, month - 1, day);
}

export function serializeDateOnly(value: Date): string {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatDateRange(startsOn: string, endsOn: string): string {
	const formatter = new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
	return `${formatter.format(parseDateOnly(startsOn))} to ${formatter.format(
		parseDateOnly(endsOn),
	)}`;
}

export function isDateWithinPeriod(
	date: Date,
	period: Pick<EducationalCoursePeriod, "startsOn" | "endsOn">,
): boolean {
	const serialized = serializeDateOnly(date);
	return serialized >= period.startsOn && serialized <= period.endsOn;
}

export function getPeriodState(
	period: Pick<
		EducationalCoursePeriod,
		"startsOn" | "endsOn" | "applicationsOpen"
	>,
	today = getEducationalCourseDateOnly(),
): "open" | "closed" | "in_progress" | "past" {
	if (period.endsOn < today) return "past";
	if (period.startsOn <= today) return "in_progress";
	if (!period.applicationsOpen) return "closed";
	return "open";
}

export function applicationStatusLabel(
	status: EducationalCourseApplicationStatus,
): string {
	if (status === "approved") return "Approved";
	if (status === "rejected") return "Not selected";
	return "Pending review";
}
