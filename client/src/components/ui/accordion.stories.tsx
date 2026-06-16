import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "./accordion";

const meta = {
	title: "UI/Accordion",
	component: Accordion,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { type: "single", collapsible: true },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => (
		<Accordion type="single" collapsible className="w-96">
			<AccordionItem value="membership">
				<AccordionTrigger>How do I join the organization?</AccordionTrigger>
				<AccordionContent>
					Submit a membership request from your profile page. An admin will
					review and approve it.
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="roles">
				<AccordionTrigger>What roles are available?</AccordionTrigger>
				<AccordionContent>
					Members can be assigned the Admin, Editor, or Member role, each with
					different permissions.
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="billing">
				<AccordionTrigger>How are dues handled?</AccordionTrigger>
				<AccordionContent>
					Dues are collected once per semester and tracked on your account page.
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	),
};
