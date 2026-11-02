import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConnectedApp } from "@/features/oauth/oauthApi";
import {
	ConnectedAppsPanel,
	type ConnectedAppsPanelProps,
} from "./ConnectedAppsPanel";

const CLAUDE: ConnectedApp = {
	clientId: "client-1",
	name: "Claude",
	scopes: ["email"],
	grantedAt: "2026-11-02T18:32:57Z",
};

function renderPanel(overrides: Partial<ConnectedAppsPanelProps> = {}) {
	const props: ConnectedAppsPanelProps = {
		apps: [CLAUDE],
		isLoading: false,
		hasError: false,
		appToRevoke: null,
		revokingClientId: null,
		onRequestRevoke: vi.fn(),
		onCancelRevoke: vi.fn(),
		onConfirmRevoke: vi.fn(),
		...overrides,
	};
	render(<ConnectedAppsPanel {...props} />);
	return props;
}

describe("ConnectedAppsPanel", () => {
	it("lists each app with when it was connected and what it gets", () => {
		renderPanel();

		expect(screen.getByText("Claude")).toBeVisible();
		expect(
			screen.getByText("Connected 2 Nov 2026 · See your email address"),
		).toBeVisible();
	});

	it("asks for confirmation through the Disconnect button", async () => {
		const props = renderPanel();

		await userEvent.click(
			screen.getByRole("button", { name: "Disconnect Claude" }),
		);

		expect(props.onRequestRevoke).toHaveBeenCalledWith(CLAUDE);
	});

	it("confirms or cancels in the dialog", async () => {
		const props = renderPanel({ appToRevoke: CLAUDE });

		expect(
			screen.getByRole("dialog", { name: "Disconnect Claude?" }),
		).toBeVisible();
		await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
		expect(props.onConfirmRevoke).toHaveBeenCalled();
		expect(props.onCancelRevoke).toHaveBeenCalled();
	});

	it("disables the buttons while an app is being disconnected", () => {
		renderPanel({ revokingClientId: "client-1" });

		expect(
			screen.getByRole("button", { name: "Disconnect Claude" }),
		).toBeDisabled();
	});

	it("shows loading, error and empty states", () => {
		const { unmount } = render(
			<ConnectedAppsPanel
				apps={[]}
				isLoading
				hasError={false}
				appToRevoke={null}
				revokingClientId={null}
				onRequestRevoke={vi.fn()}
				onCancelRevoke={vi.fn()}
				onConfirmRevoke={vi.fn()}
			/>,
		);
		expect(
			screen.getByRole("status", { name: "Loading connected apps" }),
		).toBeInTheDocument();
		unmount();

		renderPanel({ apps: [], hasError: true });
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Connected apps couldn't be loaded.",
		);
	});

	it("says when nothing is connected", () => {
		renderPanel({ apps: [] });

		expect(
			screen.getByText("No apps are connected to your account."),
		).toBeVisible();
	});
});
