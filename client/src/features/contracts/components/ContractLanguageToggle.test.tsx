import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ContractLanguageToggle } from "./ContractLanguageToggle";

describe("ContractLanguageToggle", () => {
	it("reports the picked language", async () => {
		const onChange = vi.fn();
		render(
			<ContractLanguageToggle
				value="de"
				englishAvailable
				onChange={onChange}
			/>,
		);

		await userEvent.click(screen.getByRole("radio", { name: "English" }));

		expect(onChange).toHaveBeenCalledWith("en");
	});

	it("disables English until the template is translated", () => {
		render(
			<ContractLanguageToggle
				value="de"
				englishAvailable={false}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByRole("radio", { name: "English" })).toBeDisabled();
		expect(
			screen.getByText("This template is only available in German."),
		).toBeInTheDocument();
	});

	it("ignores deselecting the active language", async () => {
		const onChange = vi.fn();
		render(
			<ContractLanguageToggle
				value="de"
				englishAvailable
				onChange={onChange}
			/>,
		);

		await userEvent.click(screen.getByRole("radio", { name: "Deutsch" }));

		expect(onChange).not.toHaveBeenCalled();
	});
});
