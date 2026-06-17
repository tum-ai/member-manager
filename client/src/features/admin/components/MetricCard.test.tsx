import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
	it("renders the label and value", () => {
		render(
			<MetricCard
				icon={<span data-testid="icon" />}
				label="Total"
				value={42}
			/>,
		);

		expect(screen.getByText("Total")).toBeInTheDocument();
		expect(screen.getByText("42")).toBeInTheDocument();
		expect(screen.getByTestId("icon")).toBeInTheDocument();
	});
});
