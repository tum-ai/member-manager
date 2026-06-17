import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolPageShell } from "./ToolPageShell";

describe("ToolPageShell", () => {
	it("renders the title heading and children", () => {
		render(
			<ToolPageShell title="My Tool">
				<p>Tool body</p>
			</ToolPageShell>,
		);

		expect(
			screen.getByRole("heading", { name: "My Tool" }),
		).toBeInTheDocument();
		expect(screen.getByText("Tool body")).toBeInTheDocument();
	});

	it("renders the optional description when provided", () => {
		render(
			<ToolPageShell title="My Tool" description="Does a thing">
				<p>body</p>
			</ToolPageShell>,
		);

		expect(screen.getByText("Does a thing")).toBeInTheDocument();
	});

	it("omits the description paragraph when not provided", () => {
		render(
			<ToolPageShell title="My Tool">
				<p>body</p>
			</ToolPageShell>,
		);

		expect(screen.queryByText("Does a thing")).not.toBeInTheDocument();
	});
});
