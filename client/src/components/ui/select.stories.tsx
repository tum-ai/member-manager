import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "./select";

const meta = {
	title: "UI/Select",
	component: Select,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Department: Story = {
	render: () => (
		<Select>
			<SelectTrigger className="w-56" aria-label="Department">
				<SelectValue placeholder="Select a department" />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>Technical</SelectLabel>
					<SelectItem value="engineering">Engineering</SelectItem>
					<SelectItem value="data">Data Science</SelectItem>
					<SelectItem value="design">Design</SelectItem>
				</SelectGroup>
				<SelectGroup>
					<SelectLabel>Operations</SelectLabel>
					<SelectItem value="marketing">Marketing</SelectItem>
					<SelectItem value="finance">Finance</SelectItem>
					<SelectItem value="hr">People & Culture</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	),
};
