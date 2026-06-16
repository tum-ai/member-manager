import type { Meta, StoryObj } from "@storybook/react-vite";
import { Markdown } from "./markdown";

const sample = `## Thesis opportunity
Develop perception models for **autonomous manipulation**.

- 6 months
- Co-supervised
- Stipend available

Reach out via the [lab page](https://example.com) or email us.`;

const long = `## About the role
We are looking for a motivated student to join the **Robotics Perception** team.

### Responsibilities
- Build and evaluate perception pipelines
- Collaborate with the manipulation group
- Document findings and present results

### Requirements
- Strong Python / C++
- Experience with PyTorch
- Interest in robotics

> Applications are reviewed on a rolling basis.`;

const meta = {
	title: "UI/Markdown",
	component: Markdown,
	parameters: { layout: "centered" },
} satisfies Meta<typeof Markdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { children: sample },
	render: (args) => (
		<div className="w-[28rem] max-w-full">
			<Markdown {...args} />
		</div>
	),
};

export const ClampedCardPreview: Story = {
	args: { children: long, clampHeight: "7.5rem" },
	render: (args) => (
		<div className="w-[24rem] max-w-full rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
			<Markdown {...args} className="text-muted-foreground" />
		</div>
	),
};

export const JobDescription: Story = {
	args: { children: sample, clampHeight: "7.5rem" },
	render: (args) => (
		<div className="w-[24rem] max-w-full rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
			<Markdown {...args} className="text-muted-foreground" />
		</div>
	),
};
