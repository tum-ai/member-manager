import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, userEvent, within } from "storybook/test";
import { OAuthConsentCard } from "./OAuthConsentCard";

const meta = {
	title: "OAuth/Consent Card",
	component: OAuthConsentCard,
	decorators: [
		(Story) => (
			<MemoryRouter>
				<div className="max-w-lg">
					<Story />
				</div>
			</MemoryRouter>
		),
	],
	args: {
		clientName: "Claude",
		redirectTarget: { label: "claude.ai", isKnownApp: true },
		scopes: ["email"],
		userEmail: "ada@example.com",
		pendingDecision: null,
		error: null,
		onApprove: fn(),
		onDeny: fn(),
		onSwitchAccount: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof OAuthConsentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KnownApp: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByText(/isn't a site we know for AI apps/),
		).not.toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
		await expect(args.onApprove).toHaveBeenCalledTimes(1);
		await userEvent.click(canvas.getByRole("button", { name: "Deny" }));
		await expect(args.onDeny).toHaveBeenCalledTimes(1);
	},
};

export const UnknownRedirect: Story = {
	args: {
		clientName: "Claude Helper",
		redirectTarget: { label: "claude-helper.example.net", isKnownApp: false },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(/claude-helper\.example\.net isn't a site we know/),
		).toBeVisible();
	},
};

export const Approving: Story = {
	args: { pendingDecision: "approve" },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const deny = canvas.getByRole("button", { name: "Deny" });
		await expect(deny).toBeDisabled();
		await userEvent.click(deny, { pointerEventsCheck: 0 });
		await expect(args.onDeny).not.toHaveBeenCalled();
	},
};

export const DecisionFailed: Story = {
	args: { error: "authorization expired" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"authorization expired",
		);
	},
};
