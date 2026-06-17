import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminDatabaseSkeleton } from "./AdminDatabaseSkeleton";

describe("AdminDatabaseSkeleton", () => {
	it("exposes an accessible loading region", () => {
		render(<AdminDatabaseSkeleton />);

		expect(
			screen.getByLabelText(/loading admin workspace/i),
		).toBeInTheDocument();
	});
});
