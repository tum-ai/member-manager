import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToastProvider } from "@/contexts/ToastContext";
import type { Member } from "@/types";
import { OrgChartDiagram } from "./OrgChartDiagram";
import { buildOrgTree } from "./orgTreeData";

function member(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "",
		given_name: "",
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

const sample: Member[] = [
	member({ given_name: "Ada", surname: "President", member_role: "President" }),
	member({ given_name: "Per", surname: "Präsident", member_role: "President" }),
	member({
		given_name: "Vera",
		surname: "Vice",
		member_role: "Vice-President",
	}),
	member({
		given_name: "Ben",
		surname: "Boardmember",
		board_role: "Board Member",
	}),
	member({ given_name: "Lea", surname: "Finance", board_role: "Board Member" }),
	// Board member who also co-leads a department — appears in both places.
	member({
		given_name: "Bianca",
		surname: "Boardlead",
		board_role: "Board Member",
		member_role: "Team Lead",
		department: "Software Development",
	}),
	member({
		given_name: "Sofia",
		surname: "Software",
		member_role: "Team Lead",
		department: "Software Development",
	}),
	member({
		given_name: "Sam",
		surname: "Dev",
		member_role: "Member",
		department: "Software Development",
	}),
	member({
		given_name: "Maya",
		surname: "Market",
		member_role: "Team Lead",
		department: "Marketing",
	}),
	member({
		given_name: "Max",
		surname: "Market",
		member_role: "Member",
		department: "Marketing",
	}),
	member({
		given_name: "Vito",
		surname: "Venture",
		member_role: "Team Lead",
		department: "Venture",
	}),
];

const meta = {
	title: "Members/OrgChartDiagram",
	component: OrgChartDiagram,
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		a11y: {
			// d3-org-chart renders node cards as HTML inside SVG <foreignObject>.
			// axe cannot resolve background-color across that boundary: even with
			// an explicit `background:var(--muted)` set directly on the initials
			// element (see orgTreeNodeContent.ts), axe still reads the page white
			// as the backdrop and reports the initials at ~1.04 contrast — a
			// confirmed false positive (CI failed PR #233 this way in dark mode,
			// where --foreground is near-white). The initials actually render on
			// the muted avatar circle at >=14:1. Documented exemption for this
			// third-party chart; tracked in #207.
			config: { rules: [{ id: "color-contrast", enabled: false }] },
		},
	},
	// OrgChartDiagram calls useToast(), so it must render inside a ToastProvider.
	decorators: [
		(Story) => (
			<ToastProvider>
				<Story />
			</ToastProvider>
		),
	],
} satisfies Meta<typeof OrgChartDiagram>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { nodes: buildOrgTree(sample) },
};

export const SinglePresident: Story = {
	args: {
		nodes: buildOrgTree(sample.filter((m) => m.surname !== "Präsident")),
	},
};
