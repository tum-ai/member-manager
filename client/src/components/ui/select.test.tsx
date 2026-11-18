import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

function renderSelect(onValueChange: (value: string) => void) {
	// Radix only renders the hidden native select inside a <form>, as on the
	// profile page.
	return render(
		<form>
			<Select value="__none__" onValueChange={onValueChange}>
				<SelectTrigger aria-label="Salutation">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="__none__">None</SelectItem>
					<SelectItem value="Mr.">Mr.</SelectItem>
				</SelectContent>
			</Select>
		</form>,
	);
}

describe("Select", () => {
	it("reports the option the user picks", async () => {
		const onValueChange = vi.fn();
		renderSelect(onValueChange);

		await userEvent.click(screen.getByRole("combobox", { name: "Salutation" }));
		await userEvent.click(await screen.findByRole("option", { name: "Mr." }));

		expect(onValueChange).toHaveBeenCalledWith("Mr.");
	});

	it("ignores the blank value Radix reports from its hidden native select (#397)", () => {
		// Radix mirrors a changed value into a hidden native select and reports
		// that select's change event. While the matching <option> is not
		// registered yet (right after the profile remounts), the event carries
		// "", which cleared salutation and batch. No item can have a blank value,
		// so a blank report is never a user choice.
		const onValueChange = vi.fn();
		const { container } = renderSelect(onValueChange);
		const nativeSelect = container.querySelector("select");
		expect(nativeSelect).not.toBeNull();

		fireEvent.change(nativeSelect as HTMLSelectElement, {
			target: { value: "" },
		});

		expect(onValueChange).not.toHaveBeenCalled();
	});
});
