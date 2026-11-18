import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	ProfileSelect,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ProfileSelect";

function renderSelect(onValueChange: (value: string) => void) {
	return render(
		<form>
			<ProfileSelect value="__none__" onValueChange={onValueChange}>
				<SelectTrigger aria-label="Salutation">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="__none__">None</SelectItem>
					<SelectItem value="Mr.">Mr.</SelectItem>
				</SelectContent>
			</ProfileSelect>
		</form>,
	);
}

describe("ProfileSelect", () => {
	it("reports the option the user picks", async () => {
		const onValueChange = vi.fn();
		renderSelect(onValueChange);

		await userEvent.click(screen.getByRole("combobox", { name: "Salutation" }));
		await userEvent.click(await screen.findByRole("option", { name: "Mr." }));

		expect(onValueChange).toHaveBeenCalledWith("Mr.");
	});

	it("still reports the None sentinel so callers can clear a field", async () => {
		const onValueChange = vi.fn();
		render(
			<form>
				<ProfileSelect value="Mr." onValueChange={onValueChange}>
					<SelectTrigger aria-label="Salutation">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">None</SelectItem>
						<SelectItem value="Mr.">Mr.</SelectItem>
					</SelectContent>
				</ProfileSelect>
			</form>,
		);

		await userEvent.click(screen.getByRole("combobox", { name: "Salutation" }));
		await userEvent.click(await screen.findByRole("option", { name: "None" }));

		expect(onValueChange).toHaveBeenCalledWith("__none__");
	});

	it("ignores the blank value Radix reports from its hidden native select (#397)", () => {
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
