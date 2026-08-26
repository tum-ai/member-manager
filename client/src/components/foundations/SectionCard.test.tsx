import { render, screen, within } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import { describe, expect, it } from "vitest";
import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
	it("associates the titled section with its heading", () => {
		render(
			<SectionCard
				icon={CalendarDays}
				title="Upcoming events"
				description="Events in the next month."
			>
				<p>Section content</p>
			</SectionCard>,
		);

		const region = screen.getByRole("region", { name: "Upcoming events" });
		expect(
			within(region).getByRole("heading", {
				name: "Upcoming events",
				level: 2,
			}),
		).toBeVisible();
		expect(within(region).getByText("Section content")).toBeVisible();
	});

	it("keeps headerless cards out of the landmarks list", () => {
		render(<SectionCard>Body only</SectionCard>);
		expect(screen.queryByRole("region")).not.toBeInTheDocument();
		expect(screen.getByText("Body only")).toBeVisible();
	});
});
