import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContractDocxReadinessPanel } from "./ContractDocxReadinessPanel";

const readiness = {
	ready: true,
	active_docx_templates: 5,
	templates_without_ready_docx: 0,
	pending_template_documents: 0,
	failed_template_documents: 0,
	pending_render_jobs: 0,
	failed_render_jobs: 0,
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
	},
} satisfies Meta<typeof ContractDocxReadinessPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const Blocked: Story = {
	args: {
		readiness: {
			...readiness,
			ready: false,
			reasons: ["An active template does not have a ready DOCX version."],
		},
	},
};
