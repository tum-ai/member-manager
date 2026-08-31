import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EducationalCoursePeriodForm } from "./EducationalCoursePeriodForm";

// Every day before tomorrow is disabled, so on the last day of a month the
// current month holds no selectable day at all. The picker must therefore open
// on the month the first selectable day is in, not on today's.
function renderFormOn(isoDateTime: string): void {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(isoDateTime));
	render(
		<EducationalCoursePeriodForm
			periods={[]}
			numberOfMonths={1}
			isCreating={false}
			onSubmit={async () => undefined}
		/>,
	);
}

function selectableDayCount(): number {
	return document.querySelectorAll("[data-day]:not([data-disabled]) button")
		.length;
}

describe("EducationalCoursePeriodForm", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("offers selectable days in the middle of a month", () => {
		renderFormOn("2026-08-12T10:00:00");

		expect(selectableDayCount()).toBeGreaterThan(2);
	});

	it("offers selectable days on the last day of a month", () => {
		renderFormOn("2026-08-31T10:00:00");

		expect(selectableDayCount()).toBeGreaterThan(2);
		// The picker moved on to the month that actually has them.
		expect(screen.getByText(/September 2026/)).toBeInTheDocument();
	});
});
