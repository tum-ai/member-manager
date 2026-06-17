import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EngagementFormActions } from "./EngagementFormActions";

function renderActions(
	overrides: Partial<React.ComponentProps<typeof EngagementFormActions>> = {},
) {
	const props: React.ComponentProps<typeof EngagementFormActions> = {
		engagementCount: 1,
		isSubmitting: false,
		isRequestPending: false,
		isGenerating: false,
		showDownload: false,
		onAddEngagement: vi.fn(),
		onDownloadApproved: vi.fn(),
		...overrides,
	};
	render(<EngagementFormActions {...props} />);
	return props;
}

describe("EngagementFormActions", () => {
	it("invokes onAddEngagement when add is clicked", async () => {
		const user = userEvent.setup();
		const props = renderActions();
		await user.click(
			screen.getByRole("button", { name: /add another engagement/i }),
		);
		expect(props.onAddEngagement).toHaveBeenCalledOnce();
	});

	it("disables the add button at the 5 engagement cap", () => {
		renderActions({ engagementCount: 5 });
		expect(
			screen.getByRole("button", { name: /add another engagement/i }),
		).toBeDisabled();
	});

	it("disables submit and shows pending copy while a request is pending", () => {
		renderActions({ isRequestPending: true });
		expect(
			screen.getByRole("button", { name: /awaiting admin review/i }),
		).toBeDisabled();
	});

	it("disables submit and shows submitting copy while submitting", () => {
		renderActions({ isSubmitting: true });
		expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
	});

	it("hides the download button unless showDownload is set", () => {
		renderActions({ showDownload: false });
		expect(
			screen.queryByRole("button", { name: /download approved certificate/i }),
		).not.toBeInTheDocument();
	});

	it("shows the download button and forwards clicks", async () => {
		const user = userEvent.setup();
		const props = renderActions({ showDownload: true });
		await user.click(
			screen.getByRole("button", { name: /download approved certificate/i }),
		);
		expect(props.onDownloadApproved).toHaveBeenCalledOnce();
	});

	it("disables and relabels the download button while generating", () => {
		renderActions({ showDownload: true, isGenerating: true });
		expect(
			screen.getByRole("button", { name: /generating approved certificate/i }),
		).toBeDisabled();
	});
});
