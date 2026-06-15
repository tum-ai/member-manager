import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./card";

const meta = {
	title: "UI/Card",
	component: Card,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MemberProfile: Story = {
	render: () => (
		<Card className="w-80">
			<CardHeader>
				<CardTitle>Ada Lovelace</CardTitle>
				<CardDescription>Board Member · Joined 2023</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-2 text-sm">
				<div className="flex justify-between">
					<span className="text-muted-foreground">Email</span>
					<span>ada@tum.ai</span>
				</div>
				<div className="flex justify-between">
					<span className="text-muted-foreground">Department</span>
					<span>Engineering</span>
				</div>
				<div className="flex justify-between">
					<span className="text-muted-foreground">Status</span>
					<span>Active</span>
				</div>
			</CardContent>
		</Card>
	),
};

export const WithFooterActions: Story = {
	render: () => (
		<Card className="w-80">
			<CardHeader>
				<CardTitle>Pending Invitation</CardTitle>
				<CardDescription>
					Grace Hopper requested to join the engineering team.
				</CardDescription>
			</CardHeader>
			<CardContent className="text-sm text-muted-foreground">
				Review the request and decide whether to grant access.
			</CardContent>
			<CardFooter className="gap-2">
				<Button variant="outline">Decline</Button>
				<Button>Approve</Button>
			</CardFooter>
		</Card>
	),
};
