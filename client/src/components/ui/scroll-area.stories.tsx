import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea } from "./scroll-area";

const meta = {
	title: "UI/ScrollArea",
	component: ScrollArea,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

const members = Array.from(
	{ length: 40 },
	(_, index) => `Member #${index + 1}`,
);

export const Default: Story = {
	render: () => (
		<ScrollArea className="h-72 w-64 rounded-md border">
			<div className="p-4">
				<h4 className="mb-4 text-sm font-medium leading-none">Members</h4>
				{members.map((member) => (
					<div
						key={member}
						className="border-b py-2 text-sm text-muted-foreground last:border-0"
					>
						{member}
					</div>
				))}
			</div>
		</ScrollArea>
	),
};
