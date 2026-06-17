import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminWorkspaceHeader } from "./AdminWorkspaceHeader";

describe("AdminWorkspaceHeader", () => {
	it("renders a metric card per stat", () => {
		render(
			<AdminWorkspaceHeader
				stats={{
					total: 120,
					active: 90,
					sepaAccepted: 75,
					privacyAccepted: 110,
				}}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: /admin workspace/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Total members")).toBeInTheDocument();
		expect(screen.getByText("120")).toBeInTheDocument();
		expect(screen.getByText("90")).toBeInTheDocument();
		expect(screen.getByText("75")).toBeInTheDocument();
		expect(screen.getByText("110")).toBeInTheDocument();
	});
});
