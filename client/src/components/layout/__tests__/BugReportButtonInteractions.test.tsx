import type { User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BugReportButton } from "@/components/layout/BugReportButton";

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

const TEST_TIMEOUT_MS = 30_000;

function renderBugReportButton(user: User | null = mockUser) {
	return render(
		<MemoryRouter initialEntries={["/tools"]}>
			<BugReportButton user={user} />
		</MemoryRouter>,
	);
}

async function openDialog(user: User | null = mockUser) {
	const session = userEvent.setup();
	renderBugReportButton(user);
	await session.click(screen.getByRole("button", { name: /report a bug/i }));
	return session;
}

function makeImageFile(type: string, sizeBytes: number): File {
	const file = new File(["x"], "shot.png", { type });
	Object.defineProperty(file, "size", { value: sizeBytes });
	return file;
}

function pasteFile(file: File | null): void {
	const dialogBody = screen.getByText(/what went wrong/i).closest("div")
		?.parentElement as HTMLElement;
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: {
			items: file
				? [{ kind: "file", type: file.type, getAsFile: () => file }]
				: [],
		},
	});
	dialogBody.dispatchEvent(event);
}

describe("BugReportButton interactions", () => {
	beforeEach(() => {
		apiClientMock.mockReset();
		showToastMock.mockReset();
	});

	it(
		"keeps the send button disabled until the message is long enough",
		async () => {
			const user = await openDialog();

			const send = screen.getByRole("button", { name: /send report/i });
			expect(send).toBeDisabled();

			await user.type(screen.getByLabelText(/what went wrong/i), "hi");
			expect(send).toBeDisabled();

			await user.type(screen.getByLabelText(/what went wrong/i), "there");
			expect(send).toBeEnabled();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"shows the submitting-as hint only when the user has an email",
		async () => {
			await openDialog();
			expect(screen.getByText(/submitting as user@test.com/i)).toBeVisible();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"shows a generic hint when no user email is present",
		async () => {
			await openDialog(null);
			expect(screen.getByText(/submitting securely/i)).toBeVisible();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"attaches a pasted screenshot and lets the user remove it",
		async () => {
			const user = await openDialog();

			pasteFile(makeImageFile("image/png", 1024));

			const image = await screen.findByAltText(/attached screenshot/i);
			expect(image).toBeInTheDocument();
			expect(showToastMock).not.toHaveBeenCalled();

			await user.click(
				screen.getByRole("button", { name: /remove attached image/i }),
			);
			expect(
				screen.queryByAltText(/attached screenshot/i),
			).not.toBeInTheDocument();
			expect(screen.getByText(/paste a screenshot/i)).toBeVisible();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"rejects a pasted image with an unsupported type",
		async () => {
			await openDialog();

			pasteFile(makeImageFile("image/bmp", 1024));

			expect(showToastMock).toHaveBeenCalledWith(
				"Only PNG, JPEG, GIF, or WebP images can be attached.",
				"error",
			);
			expect(
				screen.queryByAltText(/attached screenshot/i),
			).not.toBeInTheDocument();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"rejects a pasted image that exceeds the size limit",
		async () => {
			await openDialog();

			pasteFile(makeImageFile("image/png", 11 * 1024 * 1024));

			expect(showToastMock).toHaveBeenCalledWith(
				"Image is too large (max 10 MB).",
				"error",
			);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"ignores a paste event that carries no image",
		async () => {
			await openDialog();

			pasteFile(null);

			expect(showToastMock).not.toHaveBeenCalled();
			expect(
				screen.queryByAltText(/attached screenshot/i),
			).not.toBeInTheDocument();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"submits the attached image as a base64 payload",
		async () => {
			apiClientMock.mockResolvedValue(undefined);
			const user = await openDialog();

			pasteFile(makeImageFile("image/png", 512));
			await screen.findByAltText(/attached screenshot/i);

			await user.type(
				screen.getByLabelText(/what went wrong/i),
				"Layout breaks on paste.",
			);
			await user.click(screen.getByRole("button", { name: /send report/i }));

			await waitFor(() => expect(apiClientMock).toHaveBeenCalledTimes(1));
			const body = JSON.parse(apiClientMock.mock.calls[0][1].body);
			expect(body.image).toEqual({ dataBase64: expect.any(String) });
			expect(body.image.dataBase64.length).toBeGreaterThan(0);
			expect(body.stepsToReproduce).toBeUndefined();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"falls back to a generic error message for non-Error rejections",
		async () => {
			apiClientMock.mockRejectedValue("boom");
			const user = await openDialog();

			await user.type(
				screen.getByLabelText(/what went wrong/i),
				"Something is wrong here.",
			);
			await user.click(screen.getByRole("button", { name: /send report/i }));

			await waitFor(() =>
				expect(showToastMock).toHaveBeenCalledWith(
					"Could not submit bug report right now.",
					"error",
				),
			);
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"blocks closing the dialog while a submission is in flight",
		async () => {
			let resolveSubmit: () => void = () => {};
			apiClientMock.mockReturnValue(
				new Promise<void>((resolve) => {
					resolveSubmit = resolve;
				}),
			);
			const user = await openDialog();

			await user.type(
				screen.getByLabelText(/what went wrong/i),
				"Cannot close while sending.",
			);
			await user.click(screen.getByRole("button", { name: /send report/i }));

			// Cancel is disabled and Escape must not dismiss mid-flight.
			expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
			await user.keyboard("{Escape}");
			expect(screen.getByRole("dialog")).toBeInTheDocument();

			resolveSubmit();
			await waitFor(() =>
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			);
		},
		TEST_TIMEOUT_MS,
	);
});
