import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@/test/renderWithClient";
import {
	type FinanceMatchDialogPreset,
	FinanceMatchPlanItemDialog,
} from "./FinanceMatchPlanItemDialog";

// Started from an invoice: the posting is fixed, a Planposten is picked.
const fromPosting: FinanceMatchDialogPreset = {
	from: "posting",
	postingExternalId: "BB-1",
	planItemId: null,
	fixedLabel: "Catering Kickoff",
	openAmount: 119,
	candidates: [
		{ id: "plan-catering", label: "Catering (geplant)", openAmount: 81 },
		{ id: "plan-venue", label: "Venue-Miete", openAmount: 3570 },
	],
};

// Started from a Planposten: the plan item is fixed, a booking is picked.
const fromPlanItem: FinanceMatchDialogPreset = {
	from: "planItem",
	postingExternalId: null,
	planItemId: "plan-venue",
	fixedLabel: "Venue-Miete",
	openAmount: 3570,
	candidates: [{ id: "BB-9", label: "Hallenmiete", openAmount: 2380 }],
};

function renderDialog(
	preset: FinanceMatchDialogPreset | null,
	isPending = false,
) {
	const onClose = vi.fn();
	const onSubmit = vi.fn().mockResolvedValue(undefined);
	renderWithClient(
		<FinanceMatchPlanItemDialog
			preset={preset}
			isPending={isPending}
			onClose={onClose}
			onSubmit={onSubmit}
		/>,
	);
	return { onClose, onSubmit };
}

describe("FinanceMatchPlanItemDialog", () => {
	it("stays closed without a preset", () => {
		renderDialog(null);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	// FR-M5: the same dialog serves both directions, naming whichever side is
	// still to be picked.
	it("asks for a Planposten when started from an invoice", () => {
		renderDialog(fromPosting);

		expect(
			screen.getByRole("heading", { name: "Planposten zuordnen" }),
		).toBeInTheDocument();
		expect(screen.getByText(/Catering Kickoff · offen/)).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Planposten" }),
		).toBeInTheDocument();
	});

	it("asks for a booking when started from a Planposten", () => {
		renderDialog(fromPlanItem);

		expect(
			screen.getByRole("heading", { name: "Buchung zuordnen" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Buchung" }),
		).toBeInTheDocument();
	});

	// The open remainder of the fixed side is the sensible default.
	it("preselects the open remainder as the amount", () => {
		renderDialog(fromPosting);

		expect(screen.getByLabelText(/Betrag/)).toHaveValue(119);
	});

	// Defaulting to the smaller of the two open sides means the common
	// "this invoice settles this Planposten" case needs no arithmetic.
	it("drops the amount to the candidate's open remainder when it is smaller", async () => {
		renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("combobox", { name: "Planposten" }));
		await userEvent.click(
			screen.getByRole("option", { name: /Catering \(geplant\)/ }),
		);

		expect(screen.getByLabelText(/Betrag/)).toHaveValue(81);
	});

	it("keeps the fixed side's remainder when the candidate has more open", async () => {
		renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("combobox", { name: "Planposten" }));
		await userEvent.click(screen.getByRole("option", { name: /Venue-Miete/ }));

		expect(screen.getByLabelText(/Betrag/)).toHaveValue(119);
	});

	it("refuses to submit before a candidate is picked", async () => {
		const { onSubmit } = renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Bitte einen Planposten wählen.",
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("uses the right article when a booking is missing", async () => {
		const { onSubmit } = renderDialog(fromPlanItem);

		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Bitte eine Buchung wählen.",
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("refuses an empty amount", async () => {
		const { onSubmit } = renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("combobox", { name: "Planposten" }));
		await userEvent.click(
			screen.getByRole("option", { name: /Catering \(geplant\)/ }),
		);
		await userEvent.clear(screen.getByLabelText(/Betrag/));
		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Betrag muss größer als 0 sein.",
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("refuses a non-positive amount", async () => {
		const { onSubmit } = renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("combobox", { name: "Planposten" }));
		await userEvent.click(
			screen.getByRole("option", { name: /Catering \(geplant\)/ }),
		);
		await userEvent.clear(screen.getByLabelText(/Betrag/));
		await userEvent.type(screen.getByLabelText(/Betrag/), "0");
		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Betrag muss größer als 0 sein.",
		);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits the picked Planposten against the fixed invoice", async () => {
		const { onSubmit } = renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("combobox", { name: "Planposten" }));
		await userEvent.click(
			screen.getByRole("option", { name: /Catering \(geplant\)/ }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(onSubmit).toHaveBeenCalledWith({
			planItemId: "plan-catering",
			postingExternalId: "BB-1",
			matchedAmount: 81,
		});
	});

	// The other direction swaps which side comes from the preset and which from
	// the picker — the payload shape stays the same.
	it("submits the picked booking against the fixed Planposten", async () => {
		const { onSubmit } = renderDialog(fromPlanItem);

		await userEvent.click(screen.getByRole("combobox", { name: "Buchung" }));
		await userEvent.click(screen.getByRole("option", { name: /Hallenmiete/ }));
		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(onSubmit).toHaveBeenCalledWith({
			planItemId: "plan-venue",
			postingExternalId: "BB-9",
			matchedAmount: 2380,
		});
	});

	it("allows a partial amount", async () => {
		const { onSubmit } = renderDialog(fromPlanItem);

		await userEvent.click(screen.getByRole("combobox", { name: "Buchung" }));
		await userEvent.click(screen.getByRole("option", { name: /Hallenmiete/ }));
		await userEvent.clear(screen.getByLabelText(/Betrag/));
		await userEvent.type(screen.getByLabelText(/Betrag/), "500");
		await userEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ matchedAmount: 500 }),
		);
	});

	it("says so when there is nothing to match against", () => {
		renderDialog({ ...fromPosting, candidates: [] });

		expect(
			screen.getByText(/keinen aktiven Planposten im Zeitraum/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Zuordnen" })).toBeDisabled();
	});

	it("says so for the other direction too", () => {
		renderDialog({ ...fromPlanItem, candidates: [] });

		expect(
			screen.getByText(/keine offene Buchung im Zeitraum/),
		).toBeInTheDocument();
	});

	it("blocks the submit while a write is in flight", () => {
		renderDialog(fromPosting, true);

		expect(screen.getByRole("button", { name: "Zuordnen" })).toBeDisabled();
	});

	it("closes on cancel", async () => {
		const { onClose } = renderDialog(fromPosting);

		await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

		expect(onClose).toHaveBeenCalledOnce();
	});
});
