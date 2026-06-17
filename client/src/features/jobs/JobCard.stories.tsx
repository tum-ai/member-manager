import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PartnerJob } from "@/hooks/useJobs";
import { JobCard } from "./JobPostingsPage";

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
			// Two pre-existing violations are out of scope for the global a11y gate
			// rollout (#195) and tracked separately in #207:
			//  - nested-interactive: the whole card is role="button" yet contains the
			//    apply button/link. Fixing this is a JobCard interaction redesign.
			//  - heading-order: the demo markdown starts at "##" (rendered as <h4>)
			//    right after the card's <h2>, so levels jump h2 -> h4. A fixture/
			//    Markdown-heading-mapping concern, not a JobCard a11y defect.
			// Every other rule is still enforced here.
			config: {
				rules: [
					{ id: "nested-interactive", enabled: false },
					{ id: "heading-order", enabled: false },
				],
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
