import { ThemeProvider } from "@mui/material";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import ReimbursementReviewPage from "./ReimbursementReviewPage";

const { hookState, reviewRequestAsync } = vi.hoisted(() => ({
	reviewRequestAsync: vi.fn(),
	hookState: {
		requests: [
			{
				id: "request-1",
				user_id: "user-123",
				amount: 42.5,
				date: "2026-04-12",
				description: "Snacks for onboarding workshop guests",
				department: "Community",
				submission_type: "reimbursement",
				payment_iban: "DE89370400440532013000",
				payment_bic: "COBADEFFXXX",
				receipt_filename: "receipt.pdf",
				status: "requested",
				approval_status: "pending",
				payment_status: "to_be_paid",
			},
		],
		isLoading: false,
		error: null as Error | null,
		isReviewing: false,
	},
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

vi.mock("../../hooks/useReimbursementRequests", () => ({
	useReimbursementReview: () => ({
		requests: hookState.requests,
		isLoading: hookState.isLoading,
		error: hookState.error,
		reviewRequestAsync,
		isReviewing: hookState.isReviewing,
	}),
}));

function renderPage() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<ReimbursementReviewPage />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

describe("ReimbursementReviewPage", () => {
	beforeEach(() => {
		reviewRequestAsync.mockReset();
		reviewRequestAsync.mockResolvedValue({});
		hookState.isLoading = false;
		hookState.error = null;
		hookState.isReviewing = false;
	});

	it("shows a finance queue with actions and a back link to tools", async () => {
		const user = userEvent.setup();
		renderPage();

		expect(
			screen.getByRole("link", { name: /back to tools/i }),
		).toHaveAttribute("href", "/tools");
		expect(
			screen.getByText("Snacks for onboarding workshop guests"),
		).toBeInTheDocument();
		expect(screen.getByText(/community/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /approve/i }));

		await waitFor(() =>
			expect(reviewRequestAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				action: "approve",
			}),
		);
	});

	it("shows restricted access copy when the review API denies access", () => {
		hookState.error = new Error("Finance review access required");

		renderPage();

		expect(
			screen.getByText(/Legal & Finance members and admins/i),
		).toBeInTheDocument();
	});
});
