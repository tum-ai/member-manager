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
	args: {
		value: 60,
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
			<Progress value={0} />
			<Progress value={25} />
			<Progress value={50} />
			<Progress value={75} />
			<Progress value={100} />
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
		return <Progress value={value} className="w-72" />;
	},
};
