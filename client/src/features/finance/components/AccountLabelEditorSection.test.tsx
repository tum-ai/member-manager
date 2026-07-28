import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FinanceAccountLabelRow } from "@/features/finance/financeTypes";
import { renderWithClient } from "@/test/renderWithClient";
import { AccountLabelEditorSection } from "./AccountLabelEditorSection";

function row(
	overrides: Partial<FinanceAccountLabelRow> &
		Pick<FinanceAccountLabelRow, "account">,
): FinanceAccountLabelRow {
	return {
		label: null,
		note: null,
		posting_count: 4,
		net: -120,
		sample_texts: ["Vercel", "Notion"],
		...overrides,
	};
}

const baseProps = {
	isLoading: false,
	error: null,
	savingAccount: null,
};

describe("AccountLabelEditorSection", () => {
	it("marks unlabelled accounts and counts them", () => {
		renderWithClient(
			<AccountLabelEditorSection
				{...baseProps}
				rows={[
					row({ account: "6840" }),
					row({ account: "8450", label: "Sponsoring" }),
				]}
				onSave={vi.fn()}
			/>,
		);

		expect(screen.getAllByText("No label").length).toBeGreaterThan(0);
		expect(
			screen.getByText(/1 of 2 accounts do not have a label yet/),
		).toBeInTheDocument();
	});

	it("saves a new label explicitly and preserves its note", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<AccountLabelEditorSection
				{...baseProps}
				rows={[row({ account: "6840", note: "Software expenses" })]}
				onSave={onSave}
			/>,
		);

		const input = screen.getByLabelText(
			"Label for ledger account (Sachkonto) 6840",
		);
		await user.type(input, "Software & Tools");
		expect(onSave).not.toHaveBeenCalled();
		await user.click(
			screen.getByRole("button", {
				name: "Save label for ledger account (Sachkonto) 6840",
			}),
		);

		expect(onSave).toHaveBeenCalledWith({
			account: "6840",
			label: "Software & Tools",
			note: "Software expenses",
		});
	});

	it("does not save when the label is unchanged", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<AccountLabelEditorSection
				{...baseProps}
				rows={[row({ account: "8450", label: "Sponsoring" })]}
				onSave={onSave}
			/>,
		);

		await user.click(
			screen.getByLabelText("Label for ledger account (Sachkonto) 8450"),
		);

		expect(onSave).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", {
				name: "Save label for ledger account (Sachkonto) 8450",
			}),
		).not.toBeInTheDocument();
	});

	it("shows the missing-account sentinel in English but saves its stable key", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		renderWithClient(
			<AccountLabelEditorSection
				{...baseProps}
				rows={[row({ account: "Ohne Konto" })]}
				onSave={onSave}
			/>,
		);

		expect(screen.getByText("No account")).toBeInTheDocument();
		await user.type(
			screen.getByLabelText("Label for ledger account (Sachkonto) No account"),
			"Other",
		);
		await user.click(
			screen.getByRole("button", {
				name: "Save label for ledger account (Sachkonto) No account",
			}),
		);

		expect(onSave).toHaveBeenCalledWith({
			account: "Ohne Konto",
			label: "Other",
			note: null,
		});
	});
});
