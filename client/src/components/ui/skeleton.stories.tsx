import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./skeleton";

const meta = {
	title: "UI/Skeleton",
	component: Skeleton,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => <Skeleton className="h-4 w-48" />,
};

export const Lines: Story = {
	render: () => (
		<div className="flex flex-col gap-2">
			<Skeleton className="h-4 w-64" />
			<Skeleton className="h-4 w-56" />
			<Skeleton className="h-4 w-40" />
		</div>
	),
};

export const Card: Story = {
	render: () => (
		<div className="flex w-72 flex-col gap-3">
			<Skeleton className="h-32 w-full rounded-xl" />
			<div className="flex items-center gap-3">
				<Skeleton className="size-10 rounded-full" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-3 w-24" />
				</div>
			</div>
		</div>
	),
};
