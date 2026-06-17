import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfilePageSkeleton } from "./ProfilePageSkeleton";

describe("ProfilePageSkeleton", () => {
	it("exposes an accessible loading region", () => {
		render(<ProfilePageSkeleton />);

		expect(screen.getByLabelText(/loading profile/i)).toBeInTheDocument();
	});
});
