import { ThemeProvider } from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import getAppTheme from "../../theme";
import ReimbursementPage from "./ReimbursementPage";

const {
	createRequestAsync,
	parseReceiptAsync,
	showToast,
	hookState,
	memberState,
} = vi.hoisted(() => ({
	createRequestAsync: vi.fn(),
	parseReceiptAsync: vi.fn(),
	showToast: vi.fn(),
	hookState: {
		requests: [] as unknown[],
		isLoading: false,
		error: null as Error | null,
		isCreating: false,
		isParsingReceipt: false,
	},
	memberState: {
		member: {
			user_id: "user-123",
			department: "Software Development",
		},
		isLoading: false,
		error: null as Error | null,
	},
}));

vi.mock("../../hooks/useReimbursementRequests", () => ({
	useReimbursementRequests: () => ({
		requests: hookState.requests,
		isLoading: hookState.isLoading,
		error: hookState.error,
		createRequestAsync,
		isCreating: hookState.isCreating,
		parseReceiptAsync,
		isParsingReceipt: hookState.isParsingReceipt,
	}),
}));

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({
		showToast,
	}),
}));

vi.mock("../../hooks/useMemberData", () => ({
	useMemberData: () => memberState,
}));

const mockUser = {
	id: "user-123",
	email: "user@test.com",
} as User;

function renderPage() {
	return render(
		<ThemeProvider theme={getAppTheme("light")}>
			<MemoryRouter>
				<ReimbursementPage user={mockUser} />
			</MemoryRouter>
		</ThemeProvider>,
	);
}

async function uploadReceipt(
	user: ReturnType<typeof userEvent.setup>,
	container: HTMLElement,
) {
	const input = container.querySelector(
		'input[type="file"]',
	) as HTMLInputElement | null;
	if (!input) throw new Error("Receipt input not found");
	const receipt = new File(["%PDF-1.4"], "receipt.pdf", {
		type: "application/pdf",
	});
	await user.upload(input, receipt);
	await screen.findByText("receipt.pdf");
}

async function fillBaseRequest(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText(/amount/i), "42.50");
	await user.type(screen.getByLabelText(/date/i), "2026-04-12");
	await user.type(
		screen.getByLabelText(/description/i),
		"Snacks for onboarding workshop guests",
	);
}

describe("ReimbursementPage", () => {
	beforeEach(() => {
		createRequestAsync.mockReset();
		parseReceiptAsync.mockReset();
		parseReceiptAsync.mockResolvedValue({});
		showToast.mockReset();
		hookState.requests = [];
		hookState.isLoading = false;
		hookState.error = null;
		hookState.isCreating = false;
		hookState.isParsingReceipt = false;
		memberState.member = {
			user_id: "user-123",
			department: "Software Development",
		};
		memberState.isLoading = false;
		memberState.error = null;
	});

	it("prefills the department from the member profile and warns on overrides", async () => {
		const user = userEvent.setup();
		renderPage();

		expect(screen.getByLabelText(/department/i)).toHaveTextContent(
			"Software Development",
		);

		await user.click(screen.getByLabelText(/department/i));
		await user.click(await screen.findByRole("option", { name: "Community" }));

		expect(
			await screen.findByText(/different from your member department/i),
		).toBeInTheDocument();
	});

	it("puts receipt upload first and lets users correct extracted fields", async () => {
		parseReceiptAsync.mockResolvedValueOnce({
			amount: 42.5,
			date: "2026-04-12",
			description: "Workshop snacks",
			payment_iban: "DE89370400440532013000",
			payment_bic: "COBADEFFXXX",
		});
		const user = userEvent.setup();
		const { container } = renderPage();

		const receiptButton = screen.getByRole("button", {
			name: /attach receipt/i,
		});
		const amountInput = screen.getByLabelText(/amount/i);
		expect(
			receiptButton.compareDocumentPosition(amountInput) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		await uploadReceipt(user, container);

		await waitFor(() =>
			expect(screen.getByLabelText(/amount/i)).toHaveValue(42.5),
		);
		expect(screen.getByLabelText(/date/i)).toHaveValue("2026-04-12");
		expect(screen.getByLabelText(/description/i)).toHaveValue(
			"Workshop snacks",
		);

		await user.clear(screen.getByLabelText(/amount/i));
		await user.type(screen.getByLabelText(/amount/i), "43");
		expect(screen.getByLabelText(/amount/i)).toHaveValue(43);
	});

	it("requires IBAN and BIC for reimbursements", async () => {
		const user = userEvent.setup();
		const { container } = renderPage();

		await fillBaseRequest(user);
		await uploadReceipt(user, container);
		await user.click(screen.getByRole("button", { name: /submit request/i }));

		expect(
			await screen.findByText(/iban is required for reimbursements/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/bic is required for reimbursements/i),
		).toBeInTheDocument();
		expect(createRequestAsync).not.toHaveBeenCalled();
	}, 10_000);

	it("submits invoices without bank details", async () => {
		createRequestAsync.mockResolvedValueOnce({});
		const user = userEvent.setup();
		const { container } = renderPage();

		await user.click(screen.getByRole("button", { name: /^invoice$/i }));
		await fillBaseRequest(user);
		await uploadReceipt(user, container);
		await user.click(screen.getByRole("button", { name: /submit request/i }));

		await waitFor(() => expect(createRequestAsync).toHaveBeenCalledTimes(1));
		expect(createRequestAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				submission_type: "invoice",
				payment_iban: null,
				payment_bic: null,
				receipt_filename: "receipt.pdf",
				receipt_mime_type: "application/pdf",
			}),
		);
		expect(showToast).toHaveBeenCalledWith(
			"Reimbursement request submitted.",
			"success",
		);
	});

	it("requires a receipt before submitting", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(screen.getByRole("button", { name: /^invoice$/i }));
		await fillBaseRequest(user);
		await user.click(screen.getByRole("button", { name: /submit request/i }));

		expect(await screen.findByText(/attach a receipt/i)).toBeInTheDocument();
		expect(createRequestAsync).not.toHaveBeenCalled();
	});

	it("requires at least five description words", async () => {
		const user = userEvent.setup();
		const { container } = renderPage();

		await user.click(screen.getByRole("button", { name: /^invoice$/i }));
		await user.type(screen.getByLabelText(/amount/i), "42.50");
		await user.type(screen.getByLabelText(/date/i), "2026-04-12");
		await user.type(screen.getByLabelText(/description/i), "Workshop snacks");
		await uploadReceipt(user, container);
		await user.click(screen.getByRole("button", { name: /submit request/i }));

		expect(await screen.findByText(/at least five words/i)).toBeInTheDocument();
		expect(createRequestAsync).not.toHaveBeenCalled();
	});

	it("displays existing requests", () => {
		hookState.requests = [
			{
				id: "request-1",
				user_id: "user-123",
				amount: 120,
				date: "2026-04-14",
				description: "Workshop catering",
				department: "Legal & Finance",
				submission_type: "invoice",
				status: "requested",
				approval_status: "pending",
				payment_status: "to_be_paid",
				receipt_filename: "invoice.pdf",
			},
		];

		renderPage();

		expect(screen.getByText("Workshop catering")).toBeInTheDocument();
		expect(screen.getByText(/legal & finance/i)).toBeInTheDocument();
		expect(screen.getByText(/invoice\.pdf/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Invoice" })).toBeInTheDocument();
		expect(screen.getByText(/pending/i)).toBeInTheDocument();
	});
});
