import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Progress } from "./progress";

const meta = {
	title: "UI/Progress",
	component: Progress,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	argTypes: {
		value: { control: { type: "range", min: 0, max: 100 } },
	},
	// A progressbar needs an accessible name (aria-progressbar-name). Real
	// consumers label it for what it measures; the demo stories use a generic
	// name. Stories with their own render set their own aria-label.
	args: {
		value: 60,
		"aria-label": "Loading progress",
	},
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: (args) => <Progress {...args} className="w-72" />,
};

export const Values: Story = {
	render: () => (
		<div className="flex w-72 flex-col gap-4">
			<Progress value={0} aria-label="0 percent complete" />
			<Progress value={25} aria-label="25 percent complete" />
			<Progress value={50} aria-label="50 percent complete" />
			<Progress value={75} aria-label="75 percent complete" />
			<Progress value={100} aria-label="100 percent complete" />
		</div>
	),
};

export const Animated: Story = {
	render: () => {
		const [value, setValue] = useState(10);
		useEffect(() => {
			const timer = setInterval(() => {
				setValue((prev) => (prev >= 100 ? 0 : prev + 10));
			}, 800);
			return () => clearInterval(timer);
		}, []);
		return (
			<Progress value={value} className="w-72" aria-label="Loading progress" />
		);
	},
};
