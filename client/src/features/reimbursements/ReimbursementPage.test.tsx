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
	sepaState,
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
	sepaState: {
		sepa: {
			user_id: "user-123",
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Commerzbank",
			mandate_agreed: true,
			privacy_agreed: true,
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

vi.mock("../../hooks/useSepaData", () => ({
	useSepaData: () => sepaState,
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
		sepaState.sepa = {
			user_id: "user-123",
			iban: "DE89370400440532013000",
			bic: "COBADEFFXXX",
			bank_name: "Commerzbank",
			mandate_agreed: true,
			privacy_agreed: true,
		};
		sepaState.isLoading = false;
		sepaState.error = null;
	});

	it("prefills the department from the member profile and warns on overrides", async () => {
		const user = userEvent.setup();
		renderPage();

		expect(screen.getByLabelText(/department/i)).toHaveTextContent(
			"Software Development",
		);
		expect(screen.getByLabelText(/iban/i)).toHaveValue(
			"DE89370400440532013000",
		);
		expect(screen.getByLabelText(/bic/i)).toHaveValue("COBADEFFXXX");

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
		await user.clear(screen.getByLabelText(/iban/i));
		await user.clear(screen.getByLabelText(/bic/i));
		await user.click(screen.getByRole("button", { name: /submit request/i }));

		expect(await screen.findByText(/iban is required/i)).toBeInTheDocument();
		expect(screen.getByText(/bic is required/i)).toBeInTheDocument();
		expect(createRequestAsync).not.toHaveBeenCalled();
	}, 10_000);

	it("submits invoices with bank details from the profile", async () => {
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
				payment_iban: "DE89370400440532013000",
				payment_bic: "COBADEFFXXX",
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

	it("allows concise descriptions", async () => {
		createRequestAsync.mockResolvedValueOnce({});
		const user = userEvent.setup();
		const { container } = renderPage();

		await user.click(screen.getByRole("button", { name: /^invoice$/i }));
		await user.type(screen.getByLabelText(/amount/i), "42.50");
		await user.type(screen.getByLabelText(/date/i), "2026-04-12");
		await user.type(screen.getByLabelText(/description/i), "Workshop snacks");
		await uploadReceipt(user, container);
		await user.click(screen.getByRole("button", { name: /submit request/i }));

		await waitFor(() => expect(createRequestAsync).toHaveBeenCalledTimes(1));
		expect(createRequestAsync).toHaveBeenCalledWith(
			expect.objectContaining({
				description: "Workshop snacks",
			}),
		);
	});

	it("displays existing requests as dated rows with type and status badges", () => {
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
			{
				id: "request-2",
				user_id: "user-123",
				amount: 35,
				date: "2026-04-20",
				description: "Taxi ride",
				department: "Community",
				submission_type: "reimbursement",
				status: "requested",
				approval_status: "approved",
				payment_status: "to_be_paid",
				receipt_filename: "taxi.pdf",
			},
		];

		renderPage();

		expect(
			screen.queryByRole("heading", { name: "Workshop catering" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Taxi ride" }),
		).not.toBeInTheDocument();
		expect(screen.queryByText(/legal & finance/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/community/i)).not.toBeInTheDocument();
		expect(screen.getByText("Invoice request")).toBeInTheDocument();
		expect(screen.getByText("Reimbursement request")).toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
		expect(screen.getByText("Approved")).toBeInTheDocument();
		expect(screen.getByText(/invoice\.pdf/i)).toBeInTheDocument();
		expect(screen.getByText("Taxi ride")).toBeInTheDocument();
		expect(
			screen
				.getByText("20 Apr 2026")
				.compareDocumentPosition(screen.getByText("14 Apr 2026")) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("uses local finance copy and a receipt-first upload without a redundant receipt heading", () => {
		renderPage();

		expect(
			screen.getByText(
				/submit reimbursements or vendor invoices to the legal and finance department/i,
			),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: /^receipt$/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /attach receipt/i }),
		).toBeVisible();
	});
});
