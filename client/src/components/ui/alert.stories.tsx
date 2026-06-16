import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleAlertIcon, TerminalIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta = {
	title: "UI/Alert",
	component: Alert,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Alert className="w-[28rem]">
			<TerminalIcon />
			<AlertTitle>Heads up!</AlertTitle>
			<AlertDescription>
				You can add components to your app using the CLI.
			</AlertDescription>
		</Alert>
	),
};

export const Destructive: Story = {
	render: () => (
		<Alert variant="destructive" className="w-[28rem]">
			<CircleAlertIcon />
			<AlertTitle>Unable to process your payment.</AlertTitle>
			<AlertDescription>
				Please verify your billing information and try again.
			</AlertDescription>
		</Alert>
	),
};
