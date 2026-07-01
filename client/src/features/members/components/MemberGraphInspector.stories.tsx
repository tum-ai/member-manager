import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { buildMemberGraph } from "@/features/members/memberGraphUtils";
import type { Member } from "@/types";
import { MemberGraphInspector } from "./MemberGraphInspector";

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Example",
		given_name: "Member",
		email: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		user_id: crypto.randomUUID(),
		member_status: "active",
		...overrides,
	};
}

const graph = buildMemberGraph(
	[
		buildMember({
			user_id: "ada",
			given_name: "Ada",
			surname: "Lovelace",
			batch: "WS24",
			department: "Software Development",
			linkedin_profile_url: "https://www.linkedin.com/in/ada",
		}),
		buildMember({
			user_id: "ben",
			given_name: "Ben",
			surname: "Board",
			batch: "WS24",
			department: "Software Development",
		}),
		buildMember({
			user_id: "cara",
			given_name: "Cara",
			surname: "Community",
			batch: "WS24",
		}),
	],
	{ reasonKinds: ["batch", "department"] },
);

const meta = {
	title: "Features/Members/MemberGraphInspector",
	component: MemberGraphInspector,
	parameters: { layout: "padded" },
} satisfies Meta<typeof MemberGraphInspector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	args: { graph, selectedNode: null, onSelectNode: fn() },
	render: (args) => (
		<div className="max-w-md">
			<MemberGraphInspector {...args} />
		</div>
	),
};

export const SelectsANeighbor: Story = {
	args: {
		graph,
		selectedNode: graph.nodes.find((node) => node.id === "ada") ?? null,
		onSelectNode: fn(),
	},
	render: (args) => (
		<div className="max-w-md">
			<MemberGraphInspector {...args} />
		</div>
	),
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const neighbor = canvas.getByRole("button", { name: /Ben Board/ });
		await userEvent.click(neighbor);
		await expect(args.onSelectNode).toHaveBeenCalledWith("ben");
	},
};
