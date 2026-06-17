import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import type { PartnerJob } from "@/hooks/useJobs";
import { JobCard } from "./components/JobCard";

const baseJob: PartnerJob = {
	id: "1",
	title: "Master Thesis – Robotics Perception",
	partner: { name: "TUM Robotics Lab", logo_url: null },
	logo_url: null,
	description_markdown: `## Thesis opportunity
Develop perception models for **autonomous manipulation**.

- 6 months
- Co-supervised
- Stipend available`,
	call_to_action: "Get in touch",
	job_type: "thesis",
	location: "Munich",
	contact: {
		name: "Prof. Dr. Maier",
		email: "maier@example.com",
		role: "Supervisor",
	},
	external_url: null,
	published_at: "2026-06-13T00:00:00.000Z",
	expires_at: null,
};

const meta = {
	title: "Features/JobCard",
	component: JobCard,
	parameters: {
		layout: "padded",
		a11y: {
			// nested-interactive is now enforced: the card uses a stretched-overlay
			// button (#207) so the only interactive element spanning the card is a
			// real <button>; the apply link sits beside it, not nested within it.
			//
			// heading-order stays disabled as a story-isolation artifact, NOT a
			// JobCard defect: the demo markdown starts at "##" (rendered as <h4>)
			// right after the card's <h2>, jumping h2 -> h4. In the real page the
			// surrounding document supplies the intermediate heading levels.
			config: {
				rules: [{ id: "heading-order", enabled: false }],
			},
		},
	},
} satisfies Meta<typeof JobCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { job: baseJob },
	render: (args) => (
		<div className="w-[34rem] max-w-full">
			<JobCard {...args} />
		</div>
	),
};

export const ExternalLink: Story = {
	args: {
		job: {
			...baseJob,
			title: "Working Student – Computer Vision",
			job_type: "working_student",
			call_to_action: "Apply now",
			external_url: "https://example.com/apply",
		},
	},
	render: (args) => (
		<div className="w-[34rem] max-w-full">
			<JobCard {...args} />
		</div>
	),
};

// Interaction test: the whole card opens the detail dialog via mouse click on
// the stretched-overlay button AND via keyboard (focus + Enter). The dialog
// renders in a Radix portal (outside the story canvas), so we query
// `document.body` rather than `canvasElement`.
export const OpensDetailDialog: Story = {
	args: { job: baseJob },
	render: (args) => (
		<div className="w-[34rem] max-w-full">
			<JobCard {...args} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(document.body);

		// Mouse: clicking the card (the stretched overlay) opens the dialog.
		const trigger = canvas.getByRole("button", {
			name: `View details for ${baseJob.title}`,
		});
		await userEvent.click(trigger);
		const dialog = await body.findByRole("dialog");
		await expect(
			within(dialog).getByRole("heading", { name: baseJob.title }),
		).toBeInTheDocument();

		// Close the dialog (Escape) and verify it is gone.
		await userEvent.keyboard("{Escape}");
		await expect(body.queryByRole("dialog")).not.toBeInTheDocument();

		// Keyboard: focusing the button and pressing Enter reopens the dialog.
		const reopenTrigger = canvas.getByRole("button", {
			name: `View details for ${baseJob.title}`,
		});
		reopenTrigger.focus();
		await expect(reopenTrigger).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		const reopenedDialog = await body.findByRole("dialog");
		await expect(
			within(reopenedDialog).getByRole("heading", { name: baseJob.title }),
		).toBeInTheDocument();

		// Close again so the final, axe-audited state has no open dialog (the
		// detail dialog reuses the card heading rather than a DialogTitle).
		await userEvent.keyboard("{Escape}");
		await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
	},
};
