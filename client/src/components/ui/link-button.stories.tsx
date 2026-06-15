import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExternalLink } from "lucide-react";

import { LinkButton } from "./link-button";

const meta = {
	title: "UI/LinkButton",
	component: LinkButton,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: {
		children: "Link button",
	},
} satisfies Meta<typeof LinkButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Inline: Story = {
	render: () => (
		<p className="max-w-sm text-sm text-foreground">
			I agree to the{" "}
			<LinkButton className="font-medium" onClick={() => {}}>
				Privacy Policy
			</LinkButton>{" "}
			and the{" "}
			<LinkButton className="font-medium" onClick={() => {}}>
				SEPA mandate
			</LinkButton>
			.
		</p>
	),
};

export const AsAnchorWithIcon: Story = {
	render: () => (
		<LinkButton asChild className="inline-flex items-center gap-1.5 text-sm">
			<a href="https://example.com" target="_blank" rel="noopener noreferrer">
				<ExternalLink className="size-4" />
				View receipt
			</a>
		</LinkButton>
	),
};

export const Disabled: Story = {
	args: { disabled: true },
};
