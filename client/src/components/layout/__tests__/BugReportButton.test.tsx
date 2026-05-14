import type { User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BugReportButton from "../BugReportButton";

const { apiClientMock, showToastMock } = vi.hoisted(() => ({
	apiClientMock: vi.fn(),
	showToastMock: vi.fn(),
}));

vi.mock("../../../lib/apiClient", () => ({
	apiClient: apiClientMock,
}));

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast: showToastMock }),
}));

const mockUser = {
	id: "test-user-id",
	email: "user@test.com",
} as User;

function renderBugReportButton(initialRoute = "/members?search=ada#result") {
	return render(
		<MemoryRouter initialEntries={[initialRoute]}>
			<BugReportButton user={mockUser} />
		</MemoryRouter>,
	);
}

describe("BugReportButton", () => {
	beforeEach(() => {
		apiClientMock.mockReset();
		showToastMock.mockReset();
	});

	it("submits a bug report and disables actions while sending", async () => {
		const user = userEvent.setup();
		let resolveSubmit: () => void = () => {};
		apiClientMock.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveSubmit = resolve;
			}),
		);

		renderBugReportButton();

		await user.click(screen.getByRole("button", { name: /report a bug/i }));
		await user.type(
			screen.getByLabelText(/what went wrong/i),
			"Member search returns stale results.",
		);
		await user.type(
			screen.getByLabelText(/steps to reproduce/i),
			"Open members and search for Ada.",
		);
		await user.click(screen.getByRole("button", { name: /send report/i }));

		const requestBody = JSON.parse(apiClientMock.mock.calls[0][1].body);
		expect(apiClientMock).toHaveBeenCalledWith("/api/bug-reports", {
			method: "POST",
			body: expect.any(String),
		});
		expect(requestBody).toMatchObject({
			message: "Member search returns stale results.",
			stepsToReproduce: "Open members and search for Ada.",
			path: "/members?search=ada#result",
		});
		expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();

		resolveSubmit();

		await waitFor(() =>
			expect(showToastMock).toHaveBeenCalledWith(
				"Bug report sent. Thanks for flagging it.",
				"success",
			),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	it("shows an error toast and keeps the dialog open when submission fails", async () => {
		const user = userEvent.setup();
		apiClientMock.mockRejectedValue(new Error("Slack unavailable"));

		renderBugReportButton();

		await user.click(screen.getByRole("button", { name: /report a bug/i }));
		await user.type(screen.getByLabelText(/what went wrong/i), "Save fails.");
		await user.click(screen.getByRole("button", { name: /send report/i }));

		await waitFor(() =>
			expect(showToastMock).toHaveBeenCalledWith("Slack unavailable", "error"),
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByLabelText(/what went wrong/i)).toHaveValue(
			"Save fails.",
		);
	});
});
