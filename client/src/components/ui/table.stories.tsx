import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./table";

const meta = {
	title: "UI/Table",
	component: Table,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

const members = [
	{
		name: "Ada Lovelace",
		email: "ada@tum.ai",
		role: "Admin",
		status: "Active",
	},
	{
		name: "Grace Hopper",
		email: "grace@tum.ai",
		role: "Member",
		status: "Active",
	},
	{
		name: "Alan Turing",
		email: "alan@tum.ai",
		role: "Member",
		status: "Invited",
	},
	{
		name: "Katherine Johnson",
		email: "katherine@tum.ai",
		role: "Editor",
		status: "Inactive",
	},
];

export const Members: Story = {
	render: () => (
		<Table>
			<TableCaption>A list of team members.</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Email</TableHead>
					<TableHead>Role</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{members.map((member) => (
					<TableRow key={member.email}>
						<TableCell className="font-medium">{member.name}</TableCell>
						<TableCell>{member.email}</TableCell>
						<TableCell>{member.role}</TableCell>
						<TableCell>{member.status}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	),
};

export const WithSelectedRow: Story = {
	render: () => (
		<Table>
			<TableCaption>The second row is selected.</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Email</TableHead>
					<TableHead>Role</TableHead>
					<TableHead>Status</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{members.map((member, index) => (
					<TableRow
						key={member.email}
						data-state={index === 1 ? "selected" : undefined}
					>
						<TableCell className="font-medium">{member.name}</TableCell>
						<TableCell>{member.email}</TableCell>
						<TableCell>{member.role}</TableCell>
						<TableCell>{member.status}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	),
};
