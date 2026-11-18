import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnsavedChangesNotice } from "./UnsavedChangesNotice";

describe("UnsavedChangesNotice", () => {
	it("announces unsaved changes as a status", () => {
		render(<UnsavedChangesNotice />);

		expect(screen.getByRole("status")).toHaveTextContent(
			"Unsaved changes · save to keep them.",
		);
	});

	it("explains that the completeness percentage counts unsaved values", () => {
		render(<UnsavedChangesNotice explainCompleteness />);

		expect(screen.getByRole("status")).toHaveTextContent(
			/the percentage above includes them/i,
		);
	});
});
