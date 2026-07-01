import type { MemberGraphReasonKind } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { MemberGraphControls } from "./MemberGraphControls";

const meta = {
	title: "Features/Members/MemberGraphControls",
	component: MemberGraphControls,
	parameters: { layout: "padded" },
} satisfies Meta<typeof MemberGraphControls>;

export default meta;

type Story = StoryObj<typeof meta>;

const stats = {
	members: 24,
	shownEdges: 31,
	logicalEdges: 88,
	components: 5,
	largestComponent: 11,
	isolated: 3,
};

export const Default: Story = {
	args: {
		reasonKinds: ["batch", "department", "field", "research"],
		showAlumni: true,
		stats,
		onReasonKindsChange: fn(),
		onShowAlumniChange: fn(),
	},
};

export const TogglesAReason: Story = {
	args: {
		reasonKinds: ["batch", "department"],
		showAlumni: true,
		stats,
		onReasonKindsChange: fn(),
		onShowAlumniChange: fn(),
	},
	render: (args) => {
		const [reasonKinds, setReasonKinds] = useState<MemberGraphReasonKind[]>(
			args.reasonKinds,
		);
		return (
			<MemberGraphControls
				{...args}
				reasonKinds={reasonKinds}
				onReasonKindsChange={(next) => {
					setReasonKinds(next);
					args.onReasonKindsChange(next);
				}}
			/>
		);
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const expertiseToggle = canvas.getByRole("button", { name: "Expertise" });
		await userEvent.click(expertiseToggle);
		await expect(args.onReasonKindsChange).toHaveBeenCalled();
		await expect(expertiseToggle).toHaveAttribute("data-state", "on");
	},
};
