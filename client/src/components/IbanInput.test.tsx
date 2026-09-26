import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Label } from "@/components/ui/label";
import {
	IBAN_INVALID_HINT,
	IBAN_PLACEHOLDER,
	IBAN_VALID_HINT,
	IbanInput,
} from "./IbanInput";

const VALID_IBAN = "DE89370400440532013000";
const VALID_IBAN_GROUPED = "DE89 3704 0044 0532 0130 00";

function Harness({
	initialValue = "",
	error,
	onValueChange,
}: {
	initialValue?: string;
	error?: string;
	onValueChange?: (value: string) => void;
}) {
	const [value, setValue] = useState(initialValue);
	return (
		<>
			<Label htmlFor="iban">IBAN</Label>
			<IbanInput
				id="iban"
				value={value}
				error={error}
				onValueChange={(next) => {
					setValue(next);
					onValueChange?.(next);
				}}
			/>
			<button type="button">Next field</button>
		</>
	);
}

function getInput(): HTMLInputElement {
	return screen.getByLabelText("IBAN") as HTMLInputElement;
}

describe("IbanInput", () => {
	it("sets up a mobile-friendly text field", () => {
		render(<Harness />);
		const input = getInput();

		expect(input).toHaveAttribute("type", "text");
		expect(input).toHaveAttribute("inputmode", "text");
		expect(input).toHaveAttribute("autocapitalize", "characters");
		expect(input).toHaveAttribute("autocorrect", "off");
		expect(input).toHaveAttribute("autocomplete", "off");
		expect(input).toHaveAttribute("spellcheck", "false");
		expect(input).toHaveAttribute("placeholder", IBAN_PLACEHOLDER);
		expect(input).toHaveAttribute("aria-invalid", "false");
		expect(input).not.toHaveAttribute("aria-describedby");
	});

	it("groups typed input in blocks of four and reports the cleaned value", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness onValueChange={onValueChange} />);

		await user.type(getInput(), "de89370400440532013000");

		expect(getInput()).toHaveValue(VALID_IBAN_GROUPED);
		expect(onValueChange).toHaveBeenLastCalledWith(VALID_IBAN);
		expect(screen.getByText(IBAN_VALID_HINT)).toBeInTheDocument();
		expect(getInput()).toHaveAccessibleDescription(IBAN_VALID_HINT);
		expect(getInput()).toHaveAttribute("aria-invalid", "false");
	});

	it("shows an existing value grouped", () => {
		render(<Harness initialValue={VALID_IBAN} />);

		expect(getInput()).toHaveValue(VALID_IBAN_GROUPED);
	});

	it("strips an IBAN label and punctuation from pasted text", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness onValueChange={onValueChange} />);

		await user.click(getInput());
		await user.paste("IBAN: de89 3704-0044.0532 0130 00");

		expect(getInput()).toHaveValue(VALID_IBAN_GROUPED);
		expect(onValueChange).toHaveBeenLastCalledWith(VALID_IBAN);
	});

	it("flags an invalid paste immediately", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await user.click(getInput());
		await user.paste("DE89 3704 0044 0532 0130 01");

		expect(getInput()).toHaveAttribute("aria-invalid", "true");
		expect(getInput()).toHaveAccessibleDescription(IBAN_INVALID_HINT);
	});

	it("waits for blur before flagging a typed IBAN as invalid", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await user.type(getInput(), "DE8937");
		expect(screen.queryByText(IBAN_INVALID_HINT)).not.toBeInTheDocument();
		expect(getInput()).toHaveAttribute("aria-invalid", "false");

		await user.tab();
		expect(screen.getByText(IBAN_INVALID_HINT)).toBeInTheDocument();
		expect(getInput()).toHaveAttribute("aria-invalid", "true");

		// Once flagged, the hint follows edits live, and clears when valid.
		await user.click(getInput());
		await user.clear(getInput());
		await user.type(getInput(), VALID_IBAN);
		expect(screen.queryByText(IBAN_INVALID_HINT)).not.toBeInTheDocument();
		expect(screen.getByText(IBAN_VALID_HINT)).toBeInTheDocument();
	});

	it("flags an invalid value set from outside without focus", () => {
		render(<Harness initialValue="DE89370400440532013001" />);

		expect(getInput()).toHaveAttribute("aria-invalid", "true");
		expect(screen.getByText(IBAN_INVALID_HINT)).toBeInTheDocument();
	});

	it("lets an external error replace the built-in hint", () => {
		render(<Harness error="IBAN is required." />);

		expect(getInput()).toHaveAttribute("aria-invalid", "true");
		expect(getInput()).toHaveAccessibleDescription("IBAN is required.");
		expect(screen.queryByText(IBAN_VALID_HINT)).not.toBeInTheDocument();
	});

	it("keeps the caret in place when typing mid-string", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness initialValue="DE89370400" onValueChange={onValueChange} />);
		// "DE89 3704 00" — put the caret after "DE89 37".
		await user.type(getInput(), "1", {
			initialSelectionStart: 7,
			initialSelectionEnd: 7,
		});

		expect(onValueChange).toHaveBeenLastCalledWith("DE893710400");
		expect(getInput()).toHaveValue("DE89 3710 400");
		expect(getInput().selectionStart).toBe(8);
	});

	it("deletes the character before a group separator on backspace", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness initialValue="DE893704" onValueChange={onValueChange} />);
		// "DE89 3704" — caret right after the space.
		await user.type(getInput(), "{Backspace}", {
			initialSelectionStart: 5,
			initialSelectionEnd: 5,
		});

		expect(onValueChange).toHaveBeenLastCalledWith("DE83704");
		expect(getInput()).toHaveValue("DE83 704");
		expect(getInput().selectionStart).toBe(3);
	});

	it("deletes the character after a group separator on forward delete", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness initialValue="DE893704" onValueChange={onValueChange} />);
		// "DE89 3704" — caret right before the space.
		await user.type(getInput(), "{Delete}", {
			initialSelectionStart: 4,
			initialSelectionEnd: 4,
		});

		expect(onValueChange).toHaveBeenLastCalledWith("DE89704");
		expect(getInput()).toHaveValue("DE89 704");
		expect(getInput().selectionStart).toBe(4);
	});

	it("ignores characters that cannot appear in an IBAN", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness initialValue="DE89" onValueChange={onValueChange} />);

		await user.type(getInput(), "!");

		expect(onValueChange).toHaveBeenLastCalledWith("DE89");
		expect(getInput()).toHaveValue("DE89");
		expect(getInput().selectionStart).toBe(4);
	});

	it("caps input at the longest IBAN length", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness onValueChange={onValueChange} />);

		await user.click(getInput());
		await user.paste("MT84MALT011000012345MTLCAST001S EXTRA");

		expect(onValueChange).toHaveBeenLastCalledWith(
			"MT84MALT011000012345MTLCAST001SEXT",
		);
	});

	// Regression: replacing the grouped text with the same IBAN in electronic
	// form is shorter than the display but cleans to the same value, which the
	// separator-deletion handling used to mistake for a deleted space — it then
	// dropped the last character (Playwright `fill()` in the E2E suite hit this).
	it("keeps the IBAN when the same value is pasted over the whole field", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(<Harness initialValue={VALID_IBAN} onValueChange={onValueChange} />);

		await user.tripleClick(getInput());
		expect(getInput().selectionStart).toBe(0);
		expect(getInput().selectionEnd).toBe(VALID_IBAN_GROUPED.length);
		await user.paste(VALID_IBAN);

		expect(onValueChange).toHaveBeenLastCalledWith(VALID_IBAN);
		expect(getInput()).toHaveValue(VALID_IBAN_GROUPED);
	});

	it("keeps the IBAN when the field value is replaced wholesale", () => {
		const onValueChange = vi.fn();
		render(<Harness initialValue={VALID_IBAN} onValueChange={onValueChange} />);

		fireEvent.change(getInput(), { target: { value: VALID_IBAN } });

		expect(onValueChange).toHaveBeenLastCalledWith(VALID_IBAN);
		expect(getInput()).toHaveValue(VALID_IBAN_GROUPED);
		expect(getInput()).toHaveAttribute("aria-invalid", "false");
	});
});
