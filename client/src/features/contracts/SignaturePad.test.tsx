import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignaturePad } from "./SignaturePad";

describe("SignaturePad", () => {
	it("offers a keyboard accessible PNG upload alternative", async () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		const onChange = vi.fn();
		render(<SignaturePad onChange={onChange} />);

		const input = screen.getByLabelText("Upload PNG");
		fireEvent.change(input, {
			target: {
				files: [new File(["png"], "signature.png", { type: "image/png" })],
			},
		});

		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith(
				expect.stringMatching(/^data:image\/png;base64,/),
			),
		);
		expect(
			screen.getByText(
				"Draw with a pointer or touch. You can also upload a PNG signature.",
			),
		).toBeInTheDocument();
	});
});
