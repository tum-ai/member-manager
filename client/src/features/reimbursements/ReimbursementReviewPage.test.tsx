import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReimbursementReviewPage from "./ReimbursementReviewPage";
import type { BuchhaltungsButlerSyncStatus } from "./reimbursementTypes";

const {
	hookState,
	reviewRequestAsync,
	updateDepartmentAsync,
	openReceiptAsync,
	downloadReceiptAsync,
	syncBuchhaltungsButlerAsync,
	updateFinanceLinksAsync,
} = vi.hoisted(() => ({
	reviewRequestAsync: vi.fn(),
	updateDepartmentAsync: vi.fn(),
	openReceiptAsync: vi.fn(),
	downloadReceiptAsync: vi.fn(),
	syncBuchhaltungsButlerAsync: vi.fn(),
	updateFinanceLinksAsync: vi.fn(),
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
				bank_name: "Commerzbank",
				requester_name: "Maya Chen",
				requester_email: "maya.chen@tum.ai",
				receipt_filename: "receipt.pdf",
				receipt_view_url: "/api/reimbursements/review/request-1/receipt",
				receipt_download_url:
					"/api/reimbursements/review/request-1/receipt?download=1",
				status: "requested",
				approval_status: "pending",
				payment_status: "to_be_paid",
				created_at: "2026-04-12T10:00:00Z",
				finance_project_id: "10000000-0000-4000-8000-000000000001",
				finance_plan_item_id: "30000000-0000-4000-8000-000000000001",
				bb_posting_external_id: "BB-1001",
			},
			{
				id: "request-2",
				user_id: "user-456",
				amount: 118.2,
				date: "2026-04-18",
				description: "Cloud credits for member analytics prototype",
				department: "Software Development",
				submission_type: "invoice",
				payment_iban: "DE89370400440532013000",
				payment_bic: "COBADEFFXXX",
				bank_name: "Commerzbank",
				requester_name: "Noah Becker",
				requester_email: "noah.becker@tum.ai",
				receipt_filename: "cloud-invoice.pdf",
				receipt_view_url: "/api/reimbursements/review/request-2/receipt",
				receipt_download_url:
					"/api/reimbursements/review/request-2/receipt?download=1",
				status: "requested",
				approval_status: "approved",
				payment_status: "to_be_paid",
				created_at: "2026-04-18T10:00:00Z",
			},
			{
				id: "request-3",
				user_id: "user-789",
				amount: 64,
				date: "2026-03-30",
				description: "Board dinner after finance planning session",
				department: "Legal & Finance",
				submission_type: "reimbursement",
				payment_iban: "DE12500105170648489890",
				payment_bic: "INGDDEFFXXX",
				bank_name: "ING",
				requester_name: "Lina Wolf",
				requester_email: "lina.wolf@tum.ai",
				receipt_filename: "dinner.pdf",
				status: "paid",
				approval_status: "approved",
				payment_status: "paid",
				created_at: "2026-03-30T10:00:00Z",
			},
		],
		isLoading: false,
		error: null as Error | null,
		isReviewing: false,
		isUpdatingDepartment: false,
		isUpdatingFinanceLinks: false,
		financeProjects: [
			{
				id: "10000000-0000-4000-8000-000000000001",
				parent_project_id: null,
				name: "Community Events 2026",
				department: "Community",
				period_type: "year",
				period_key: "2026",
				tax_area: null,
				target_amount: 1000,
				status: "active",
				description: null,
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "10000000-0000-4000-8000-000000000002",
				parent_project_id: null,
				name: "Community Events 2027",
				department: "Community",
				period_type: "year",
				period_key: "2027",
				tax_area: null,
				target_amount: 1000,
				status: "active",
				description: null,
				created_at: "2026-01-01T00:00:00.000Z",
				updated_at: "2026-01-01T00:00:00.000Z",
			},
		],
		financePlanItems: [
			{
				id: "30000000-0000-4000-8000-000000000001",
				department: "Community",
				period_type: "year",
				period_key: "2026",
				label: "Workshop catering",
				category: null,
				planned_amount: 250,
				expected_month: null,
				status: "planned",
				note: null,
			},
		],
		financePostings: [
			{
				external_id: "BB-1001",
				date: "2026-04-12",
				postingtext: "Workshop supplies",
				amount: -42.5,
				currency: "EUR",
				vat: 19,
				credit_type: "debit",
				debit_postingaccount_number: "6840",
				credit_postingaccount_number: "1200",
				cost_location: "110",
				cost_location_two: "4",
				transaction_amount: -42.5,
				transaction_purpose: "Onboarding workshop",
			},
		],
		buchhaltungsButlerSyncStatus: {
			sync_enabled: true,
			configured: true,
			available: true,
			unavailable_reason: null,
		} as BuchhaltungsButlerSyncStatus,
		isLoadingBuchhaltungsButlerSyncStatus: false,
		buchhaltungsButlerSyncStatusError: null as Error | null,
		canBulkDownloadReceipts: true,
		isBulkDownloadingReceipts: false,
		bulkDownloadReceiptsAsync: vi.fn(),
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
		updateDepartmentAsync,
		isReviewing: hookState.isReviewing,
		isUpdatingDepartment: hookState.isUpdatingDepartment,
		financeProjects: hookState.financeProjects,
		financePlanItems: hookState.financePlanItems,
		financePostings: hookState.financePostings,
		updateFinanceLinksAsync,
		isUpdatingFinanceLinks: hookState.isUpdatingFinanceLinks,
		canBulkDownloadReceipts: hookState.canBulkDownloadReceipts,
		isBulkDownloadingReceipts: hookState.isBulkDownloadingReceipts,
		bulkDownloadReceiptsAsync: hookState.bulkDownloadReceiptsAsync,
		openReceiptAsync,
		downloadReceiptAsync,
		buchhaltungsButlerSyncStatus: hookState.buchhaltungsButlerSyncStatus,
		isLoadingBuchhaltungsButlerSyncStatus:
			hookState.isLoadingBuchhaltungsButlerSyncStatus,
		buchhaltungsButlerSyncStatusError:
			hookState.buchhaltungsButlerSyncStatusError,
		syncBuchhaltungsButlerAsync,
		isSyncingBuchhaltungsButler: false,
	}),
}));

function renderPage() {
	return render(
		<MemoryRouter>
			<ReimbursementReviewPage />
		</MemoryRouter>,
	);
}

describe("ReimbursementReviewPage", () => {
	beforeEach(() => {
		reviewRequestAsync.mockReset();
		reviewRequestAsync.mockResolvedValue({});
		updateDepartmentAsync.mockReset();
		updateDepartmentAsync.mockResolvedValue({});
		updateFinanceLinksAsync.mockReset();
		updateFinanceLinksAsync.mockResolvedValue({});
		openReceiptAsync.mockReset();
		openReceiptAsync.mockResolvedValue({});
		downloadReceiptAsync.mockReset();
		downloadReceiptAsync.mockResolvedValue({});
		syncBuchhaltungsButlerAsync.mockReset();
		syncBuchhaltungsButlerAsync.mockResolvedValue({});
		hookState.bulkDownloadReceiptsAsync.mockReset();
		hookState.bulkDownloadReceiptsAsync.mockResolvedValue({});
		hookState.isLoading = false;
		hookState.error = null;
		hookState.isReviewing = false;
		hookState.isUpdatingDepartment = false;
		hookState.isUpdatingFinanceLinks = false;
		hookState.buchhaltungsButlerSyncStatus = {
			sync_enabled: true,
			configured: true,
			available: true,
			unavailable_reason: null,
		};
		hookState.isLoadingBuchhaltungsButlerSyncStatus = false;
		hookState.buchhaltungsButlerSyncStatusError = null;
		hookState.canBulkDownloadReceipts = true;
		hookState.isBulkDownloadingReceipts = false;
	});

	it("shows a finance queue with actions", async () => {
		const user = userEvent.setup();
		renderPage();

		expect(
			screen.getAllByText("Snacks for onboarding workshop guests")[0],
		).toBeInTheDocument();
		expect(screen.getAllByText(/community/i)[0]).toBeInTheDocument();
		expect(
			screen
				.getByRole("button", {
					name: /cloud credits for member analytics prototype/i,
				})
				.compareDocumentPosition(
					screen.getByRole("button", {
						name: /snacks for onboarding workshop guests/i,
					}),
				) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		await user.click(
			screen.getByRole("button", {
				name: /snacks for onboarding workshop guests/i,
			}),
		);
		await user.click(screen.getByRole("button", { name: /^approve$/i }));

		await waitFor(() =>
			expect(reviewRequestAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				action: "approve",
			}),
		);
	}, 30_000);

	it("lets finance reviewers click the amount to select/copy it without toggling the row", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(screen.getByText(/42,50/));

		expect(
			screen.queryByRole("button", { name: /^approve$/i }),
		).not.toBeInTheDocument();
	});

	it("keeps finance review badges non-duplicative in collapsed rows", () => {
		renderPage();

		const pendingRequest = screen.getByRole("button", {
			name: /snacks for onboarding workshop guests/i,
		});

		expect(within(pendingRequest).getAllByText("Needs approval")).toHaveLength(
			1,
		);
		expect(
			within(pendingRequest).queryByText("Pending"),
		).not.toBeInTheDocument();
		expect(
			within(pendingRequest).queryByText("To Be Paid"),
		).not.toBeInTheDocument();
	});

	it("lets finance reviewers change a request department", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(
			screen.getByRole("button", {
				name: /snacks for onboarding workshop guests/i,
			}),
		);
		await user.click(
			screen.getByRole("combobox", { name: /request department/i }),
		);
		await user.click(screen.getByRole("option", { name: "Makeathon" }));

		await waitFor(() =>
			expect(updateDepartmentAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				department: "Makeathon",
			}),
		);
	});

	it("clears an existing plan item when changing the linked project", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(
			screen.getByRole("button", {
				name: /snacks for onboarding workshop guests/i,
			}),
		);
		expect(screen.getByLabelText("Finance plan item")).toHaveTextContent(
			"Workshop catering",
		);
		await user.click(screen.getByLabelText("Finance project"));
		await user.click(
			screen.getByRole("option", { name: "Community Events 2027" }),
		);
		await user.click(screen.getByRole("button", { name: "Save links" }));

		await waitFor(() =>
			expect(updateFinanceLinksAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				finance_project_id: "10000000-0000-4000-8000-000000000002",
				finance_plan_item_id: null,
				bb_posting_external_id: "BB-1001",
			}),
		);
	});

	it("submits explicit nulls when a reviewer clears finance links", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(
			screen.getByRole("button", {
				name: /snacks for onboarding workshop guests/i,
			}),
		);
		await user.click(screen.getByLabelText("Finance project"));
		await user.click(screen.getByRole("option", { name: "No project" }));
		await user.click(screen.getByLabelText("BB posting"));
		await user.click(screen.getByText("No posting"));
		await user.click(screen.getByRole("button", { name: "Save links" }));

		await waitFor(() =>
			expect(updateFinanceLinksAsync).toHaveBeenCalledWith({
				requestId: "request-1",
				finance_project_id: null,
				finance_plan_item_id: null,
				bb_posting_external_id: null,
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

	it("filters by search, quick status, and department while keeping requester details visible", async () => {
		const user = userEvent.setup();
		renderPage();

		const pendingRequest = screen.getByRole("button", {
			name: /snacks for onboarding workshop guests/i,
		});
		expect(pendingRequest).toHaveTextContent("Maya Chen");
		await user.click(pendingRequest);
		expect(screen.getAllByText("maya.chen@tum.ai")[0]).toBeInTheDocument();
		expect(screen.getAllByText("Commerzbank")[0]).toBeInTheDocument();
		expect(
			screen.getAllByText("DE89370400440532013000")[0],
		).toBeInTheDocument();
		await user.click(pendingRequest);

		await user.type(
			screen.getByRole("textbox", { name: /search reimbursement queue/i }),
			"cloud",
		);

		expect(
			screen.getAllByText("Cloud credits for member analytics prototype")[0],
		).toBeInTheDocument();
		expect(
			screen.queryByText("Snacks for onboarding workshop guests"),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /clear filters/i }));
		await user.click(
			screen.getByRole("button", { name: /approved, not paid/i }),
		);

		expect(
			screen.getAllByText("Cloud credits for member analytics prototype")[0],
		).toBeInTheDocument();
		expect(
			screen.queryByText("Board dinner after finance planning session"),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("combobox", { name: /^department$/i }));
		await user.click(screen.getByRole("option", { name: "Community" }));

		expect(
			screen.getByText(/no reimbursement requests match/i),
		).toBeInTheDocument();
	}, 30_000);

	it("exposes receipt links and bulk downloads selected receipts when endpoints are available", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(
			screen.getByRole("button", {
				name: /snacks for onboarding workshop guests/i,
			}),
		);

		expect(
			screen.getAllByRole("link", { name: /view receipt/i })[0],
		).toHaveAttribute("href", "/api/reimbursements/review/request-1/receipt");
		expect(
			screen.getAllByRole("link", { name: /download receipt/i })[0],
		).toHaveAttribute(
			"href",
			"/api/reimbursements/review/request-1/receipt?download=1",
		);
		await user.click(screen.getAllByRole("link", { name: /view receipt/i })[0]);
		await waitFor(() =>
			expect(openReceiptAsync).toHaveBeenCalledWith(hookState.requests[0]),
		);
		await user.click(
			screen.getAllByRole("link", { name: /download receipt/i })[0],
		);
		await waitFor(() =>
			expect(downloadReceiptAsync).toHaveBeenCalledWith(hookState.requests[0]),
		);

		await user.click(
			screen.getByRole("checkbox", { name: /select receipt from maya chen/i }),
		);
		await user.click(
			screen.getByRole("button", { name: /download selected receipts/i }),
		);

		await waitFor(() =>
			expect(hookState.bulkDownloadReceiptsAsync).toHaveBeenCalledWith([
				"request-1",
			]),
		);
	});

	it("keeps bulk receipt selection available in the card review layout", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.click(
			screen.getByRole("checkbox", { name: /select receipt from maya chen/i }),
		);
		await user.click(
			screen.getByRole("button", { name: /download selected receipts/i }),
		);

		await waitFor(() =>
			expect(hookState.bulkDownloadReceiptsAsync).toHaveBeenCalledWith([
				"request-1",
			]),
		);
	});

	it("disables BuchhaltungsButler sync when the server reports it unavailable", async () => {
		const user = userEvent.setup();
		hookState.buchhaltungsButlerSyncStatus = {
			sync_enabled: false,
			configured: true,
			available: false,
			unavailable_reason: "disabled",
		};
		renderPage();

		await user.click(
			screen.getByRole("button", {
				name: /cloud credits for member analytics prototype/i,
			}),
		);

		expect(
			screen.getByRole("button", { name: /sync unavailable/i }),
		).toBeDisabled();
		expect(
			screen.getAllByText(/buchhaltungsbutler sync is disabled/i),
		).not.toHaveLength(0);
	});
});
