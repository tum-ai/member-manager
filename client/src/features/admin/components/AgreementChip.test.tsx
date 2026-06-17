import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgreementChip } from "./AgreementChip";

describe("AgreementChip", () => {
	it("labels an accepted agreement", () => {
		render(<AgreementChip accepted={true} />);

		expect(screen.getByRole("img", { name: "Accepted" })).toBeInTheDocument();
	});

	it("labels a not-accepted agreement", () => {
		render(<AgreementChip accepted={false} />);

		expect(
			screen.getByRole("img", { name: "Not accepted" }),
		).toBeInTheDocument();
	});
});
