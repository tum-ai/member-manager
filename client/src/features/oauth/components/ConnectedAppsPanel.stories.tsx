import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import type { ConnectedApp } from "@/features/oauth/oauthApi";
import { ConnectedAppsPanel } from "./ConnectedAppsPanel";

const apps: ConnectedApp[] = [
	{
		clientId: "client-1",
		name: "Claude",
		scopes: ["email"],
		grantedAt: "2026-11-02T18:32:57Z",
	},
	{
		clientId: "client-2",
		name: "ChatGPT",
		scopes: [],
		grantedAt: "2026-10-28T09:00:00Z",
	},
];

const meta = {
	title: "OAuth/Connected Apps Panel",
	component: ConnectedAppsPanel,
	args: {
		apps,
		isLoading: false,
		hasError: false,
		appToRevoke: null,
		revokingClientId: null,
		onRequestRevoke: fn(),
		onCancelRevoke: fn(),
		onConfirmRevoke: fn(),
	},
	parameters: {
		a11y: {
			test: "error",
		},
	},
} satisfies Meta<typeof ConnectedAppsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Listed: Story = {
	// Hold the confirmation state like useConnectedApps does, so the play
	// function exercises the real Disconnect → confirm round trip.
	render: function Render(args) {
		const [appToRevoke, setAppToRevoke] = useState<ConnectedApp | null>(null);
		return (
			<ConnectedAppsPanel
				{...args}
				appToRevoke={appToRevoke}
				onRequestRevoke={(app) => {
					args.onRequestRevoke(app);
					setAppToRevoke(app);
				}}
				onCancelRevoke={() => {
					args.onCancelRevoke();
					setAppToRevoke(null);
				}}
				onConfirmRevoke={() => {
					args.onConfirmRevoke();
					setAppToRevoke(null);
				}}
			/>
		);
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Disconnect Claude" }),
		);
		await expect(args.onRequestRevoke).toHaveBeenCalledWith(apps[0]);
		// The dialog renders in a portal outside the canvas.
		const dialog = await screen.findByRole("dialog", {
			name: "Disconnect Claude?",
		});
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Disconnect" }),
		);
		await expect(args.onConfirmRevoke).toHaveBeenCalledTimes(1);
	},
};

export const Disconnecting: Story = {
	args: { revokingClientId: "client-1" },
};

export const Empty: Story = {
	args: { apps: [] },
};

export const LoadFailed: Story = {
	args: { apps: [], hasError: true },
};

export const Loading: Story = {
	args: { apps: [], isLoading: true },
};
