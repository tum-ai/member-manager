import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterSelect } from "./FilterSelect";

const options = [
	{ label: "All", value: "" },
	{ label: "Accepted", value: "true" },
	{ label: "Not accepted", value: "false" },
];

describe("FilterSelect", () => {
	it("shows the label for the currently selected value", () => {
		render(
			<FilterSelect
				label="SEPA mandate"
				value="true"
				onValueChange={vi.fn()}
				options={options}
			/>,
		);

		expect(
			screen.getByRole("combobox", { name: /sepa mandate/i }),
		).toHaveTextContent("Accepted");
	});

	it("emits the selected option value", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(
			<FilterSelect
				label="SEPA mandate"
				value=""
				onValueChange={onValueChange}
				options={options}
			/>,
		);

		await user.click(screen.getByRole("combobox", { name: /sepa mandate/i }));
		await user.click(await screen.findByRole("option", { name: "Accepted" }));

		expect(onValueChange).toHaveBeenCalledWith("true");
	});

	it("maps the sentinel 'All' option back to an empty string", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(
			<FilterSelect
				label="SEPA mandate"
				value="true"
				onValueChange={onValueChange}
				options={options}
			/>,
		);

		await user.click(screen.getByRole("combobox", { name: /sepa mandate/i }));
		await user.click(await screen.findByRole("option", { name: "All" }));

		expect(onValueChange).toHaveBeenCalledWith("");
	});
});
