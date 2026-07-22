import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { FinanceAccountLabelRow } from "@/features/finance/financeTypes";
import { AccountLabelEditorSection } from "./AccountLabelEditorSection";

const rows: FinanceAccountLabelRow[] = [
	{
		account: "6840",
		label: null,
		note: null,
		posting_count: 63,
		net: -3900,
		sample_texts: ["Vercel subscription", "Notion subscription"],
	},
	{
		account: "8450",
		label: "Erlöse Sponsoring",
		note: null,
		posting_count: 3,
		net: 30000,
		sample_texts: ["Sponsoring JetBrains", "Sponsoring HRT"],
	},
];

const meta = {
	title: "Features/Finance/AccountLabelEditorSection",
	component: AccountLabelEditorSection,
	parameters: { layout: "padded" },
} satisfies Meta<typeof AccountLabelEditorSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		rows,
		isLoading: false,
		error: null,
		savingAccount: null,
		onSave: fn(),
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Ohne Bezeichnung")).toBeInTheDocument();

		const input = canvas.getByLabelText("Bezeichnung für Konto 6840");
		await userEvent.type(input, "Software & Tools");
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Bezeichnung für Konto 6840 speichern",
			}),
		);
		await expect(args.onSave).toHaveBeenCalledWith({
			account: "6840",
			label: "Software & Tools",
			note: null,
		});
	},
};

export const Loading: Story = {
	args: {
		rows: [],
		isLoading: true,
		error: null,
		savingAccount: null,
		onSave: () => undefined,
	},
};
