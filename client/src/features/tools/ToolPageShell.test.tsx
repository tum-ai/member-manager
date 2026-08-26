import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import { ToolPageShell } from "./ToolPageShell";

describe("ToolPageShell", () => {
	it("publishes the title to the app header and renders children", () => {
		renderWithClient(
			<ToolPageShell title="My Tool">
				<p>Tool body</p>
			</ToolPageShell>,
		);

		expect(
			screen.getByRole("heading", { name: "My Tool" }),
		).toBeInTheDocument();
		expect(screen.getByText("Tool body")).toBeInTheDocument();
	});

	it("publishes the optional description when provided", () => {
		renderWithClient(
			<ToolPageShell title="My Tool" description="Does a thing">
				<p>body</p>
			</ToolPageShell>,
		);

		expect(screen.getByText("Does a thing")).toBeInTheDocument();
	});

	it("omits the description when not provided", () => {
		renderWithClient(
			<ToolPageShell title="My Tool">
				<p>body</p>
			</ToolPageShell>,
		);

		expect(screen.queryByText("Does a thing")).not.toBeInTheDocument();
	});
});
