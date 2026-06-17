import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EducationFields } from "./EducationFields";

const onChange = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
});

async function chooseOption(
	userEv: ReturnType<typeof userEvent.setup>,
	triggerName: RegExp,
	optionName: RegExp,
	index = 0,
): Promise<void> {
	const trigger = screen.getAllByRole("combobox", { name: triggerName })[index];
	await userEv.click(trigger);
	const listbox = await screen.findByRole("listbox");
	await userEv.click(within(listbox).getByRole("option", { name: optionName }));
}

describe("EducationFields", () => {
	it("renders a single empty entry when no values are provided", () => {
		render(<EducationFields onChange={onChange} />);
		expect(
			screen.getByRole("combobox", { name: "Degree" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Program" }),
		).toBeInTheDocument();
		// A lone empty entry hides the "Remove study" affordance.
		expect(
			screen.queryByRole("button", { name: /remove study/i }),
		).not.toBeInTheDocument();
	});

	it("hydrates preset degree, program and school values from props", () => {
		render(
			<EducationFields
				degreeValue="Bachelor Aerospace"
				schoolValue="TUM"
				onChange={onChange}
			/>,
		);
		expect(screen.getByRole("combobox", { name: "Degree" })).toHaveTextContent(
			"Bachelor",
		);
		expect(screen.getByRole("combobox", { name: "Program" })).toHaveTextContent(
			"Aerospace",
		);
		expect(screen.getByRole("combobox", { name: /school/i })).toHaveTextContent(
			"TUM",
		);
	});

	it("shows custom inputs when stored values are not in the presets", () => {
		render(
			<EducationFields
				degreeValue="Bachelor Underwater Basket Weaving"
				schoolValue="Atlantis University"
				onChange={onChange}
			/>,
		);
		expect(screen.getByLabelText(/custom program name/i)).toHaveValue(
			"Underwater Basket Weaving",
		);
		expect(screen.getByLabelText(/custom school/i)).toHaveValue(
			"Atlantis University",
		);
	});

	it("commits a serialized degree when the degree type changes", async () => {
		const userEv = userEvent.setup();
		render(
			<EducationFields
				degreeValue="Aerospace"
				schoolValue=""
				onChange={onChange}
			/>,
		);

		await chooseOption(userEv, /degree/i, /^Master$/);

		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith({
				degree: "Master Aerospace",
				school: "",
			}),
		);
	});

	it("clears the degree type when None is selected", async () => {
		const userEv = userEvent.setup();
		render(
			<EducationFields
				degreeValue="Bachelor Aerospace"
				schoolValue=""
				onChange={onChange}
			/>,
		);

		await chooseOption(userEv, /degree/i, /^None$/);

		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith({
				degree: "Aerospace",
				school: "",
			}),
		);
	});

	it("reveals and stores a custom program when Other is selected", async () => {
		const userEv = userEvent.setup();
		render(
			<EducationFields
				degreeValue="Bachelor"
				schoolValue=""
				onChange={onChange}
			/>,
		);

		await chooseOption(userEv, /program/i, /other \(custom\)/i);

		const customInput = await screen.findByLabelText(/custom program name/i);
		fireEvent.change(customInput, { target: { value: "Quantum Studies" } });

		await waitFor(() =>
			expect(onChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ degree: "Bachelor Quantum Studies" }),
			),
		);
	});

	it("reveals and stores a custom school when Other is selected", async () => {
		const userEv = userEvent.setup();
		render(
			<EducationFields degreeValue="" schoolValue="" onChange={onChange} />,
		);

		await chooseOption(userEv, /school/i, /other \(custom\)/i);

		const customInput = await screen.findByLabelText(/custom school/i);
		fireEvent.change(customInput, { target: { value: "Hogwarts" } });

		await waitFor(() =>
			expect(onChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ school: "Hogwarts" }),
			),
		);
	});

	it("selects a preset program and a preset school", async () => {
		const userEv = userEvent.setup();
		render(
			<EducationFields
				degreeValue="Bachelor"
				schoolValue=""
				onChange={onChange}
			/>,
		);

		await chooseOption(userEv, /program/i, /^Biology$/);
		await waitFor(() =>
			expect(onChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ degree: "Bachelor Biology" }),
			),
		);

		await chooseOption(userEv, /school/i, /^LMU$/);
		await waitFor(() =>
			expect(onChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ school: "LMU" }),
			),
		);
	});

	it("adds and removes study entries", async () => {
		const userEv = userEvent.setup();
		render(
			<EducationFields
				degreeValue="Bachelor Aerospace"
				schoolValue="TUM"
				onChange={onChange}
			/>,
		);

		await userEv.click(
			screen.getByRole("button", { name: /add another study/i }),
		);

		expect(screen.getAllByRole("combobox", { name: "Degree" })).toHaveLength(2);
		const removeButtons = screen.getAllByRole("button", {
			name: /remove study/i,
		});
		expect(removeButtons).toHaveLength(2);

		await userEv.click(removeButtons[1]);

		await waitFor(() =>
			expect(screen.getAllByRole("combobox", { name: "Degree" })).toHaveLength(
				1,
			),
		);
	});

	it("re-syncs entries when the incoming props change", async () => {
		const { rerender } = render(
			<EducationFields
				degreeValue="Bachelor Aerospace"
				schoolValue="TUM"
				onChange={onChange}
			/>,
		);
		expect(screen.getByRole("combobox", { name: "Program" })).toHaveTextContent(
			"Aerospace",
		);

		rerender(
			<EducationFields
				degreeValue="Master Chemistry"
				schoolValue="LMU"
				onChange={onChange}
			/>,
		);

		await waitFor(() =>
			expect(
				screen.getByRole("combobox", { name: "Program" }),
			).toHaveTextContent("Chemistry"),
		);
		expect(screen.getByRole("combobox", { name: "Degree" })).toHaveTextContent(
			"Master",
		);
	});

	it("ignores prop updates that match the last committed values", async () => {
		const userEv = userEvent.setup();
		const { rerender } = render(
			<EducationFields
				degreeValue="Bachelor Aerospace"
				schoolValue="TUM"
				onChange={onChange}
			/>,
		);

		await chooseOption(userEv, /degree/i, /^Master$/);
		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith({
				degree: "Master Aerospace",
				school: "TUM",
			}),
		);

		// Re-rendering with the values the component just committed must not reset it.
		rerender(
			<EducationFields
				degreeValue="Master Aerospace"
				schoolValue="TUM"
				onChange={onChange}
			/>,
		);

		expect(screen.getByRole("combobox", { name: "Degree" })).toHaveTextContent(
			"Master",
		);
	});
});
