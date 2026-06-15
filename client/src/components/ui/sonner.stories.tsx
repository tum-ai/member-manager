import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
	title: "UI/Sonner",
	component: Toaster,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<div className="flex flex-wrap items-center gap-3">
			<Toaster />
			<Button
				variant="outline"
				onClick={() => toast("Event has been created.")}
			>
				Default
			</Button>
			<Button
				variant="outline"
				onClick={() => toast.success("Event has been created.")}
			>
				Success
			</Button>
			<Button
				variant="outline"
				onClick={() => toast.error("Something went wrong.")}
			>
				Error
			</Button>
			<Button
				variant="outline"
				onClick={() =>
					toast("Event has been created.", {
						description: "Sunday, December 03, 2023 at 9:00 AM",
						action: {
							label: "Undo",
							onClick: () => toast("Undone."),
						},
					})
				}
			>
				With action
			</Button>
		</div>
	),
};
