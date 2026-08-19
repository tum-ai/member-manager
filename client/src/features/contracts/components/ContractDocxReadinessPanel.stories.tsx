import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ContractDocxReadinessPanel } from "./ContractDocxReadinessPanel";

const readiness = {
	enabled: false,
	ready: true,
	active_docx_templates: 5,
	legacy_templates: 0,
	pending_template_documents: 0,
	failed_template_documents: 0,
	pending_render_jobs: 0,
	failed_render_jobs: 0,
	legacy_submissions_without_pdf: 0,
	reasons: [],
};

const meta = {
	title: "Contracts/DocxReadiness",
	component: ContractDocxReadinessPanel,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: {
		readiness,
		loading: false,
		error: null,
		cutoverPending: false,
		cutoverError: null,
		enabled: false,
		cutoverTarget: null,
		onRequestCutover: fn(),
		onCancelCutover: fn(),
		onConfirmCutover: fn(),
	},
} satisfies Meta<typeof ContractDocxReadinessPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyToEnable: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Enable DOCX cutover" }),
		);
		await expect(args.onRequestCutover).toHaveBeenCalledWith(true);
	},
};

export const ConfirmEmergencyPause: Story = {
	args: {
		readiness: { ...readiness, enabled: true },
		enabled: true,
		cutoverTarget: false,
	},
	play: async ({ args }) => {
		const body = within(document.body);
		await userEvent.click(body.getByRole("button", { name: "Pause cutover" }));
		await expect(args.onConfirmCutover).toHaveBeenCalled();
	},
};
