import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReimbursementReviewQueue } from "./ReimbursementReviewQueue";
import type { ReimbursementRequest } from "./reimbursementTypes";

function makeRequest(
	overrides: Partial<ReimbursementRequest> & { id: string },
): ReimbursementRequest {
	return {
		user_id: "u1",
		requester_name: "Clara Community",
		amount: 19.99,
		date: "2026-06-07",
		description: "Community stickers without budget approval",
		department: "Community",
		submission_type: "reimbursement",
		status: "requested",
		approval_status: "pending",
		payment_status: "to_be_paid",
		bb_sync_status: "not_synced",
		...overrides,
	};
}

const requests: ReimbursementRequest[] = [
	makeRequest({
		id: "1",
		description: "Community stickers without budget approval",
		requester_name: "Clara Community",
		department: "Community",
		amount: 19.99,
		approval_status: "not_approved",
		status: "rejected",
	}),
	makeRequest({
		id: "2",
		description: "Train ticket to Munich AI meetup",
		requester_name: "Regular User",
		department: "Software Development",
		amount: 42.5,
		approval_status: "pending",
	}),
	makeRequest({
		id: "3",
		description: "Makeathon prototype materials",
		requester_name: "Maya Makeathon",
		department: "Makeathon",
		amount: 128.9,
		submission_type: "invoice",
		approval_status: "approved",
	}),
	makeRequest({
		id: "4",
		description: "Finance workshop catering",
		requester_name: "Lea Finance",
		department: "Legal & Finance",
		amount: 75,
		approval_status: "approved",
		payment_status: "paid",
		status: "paid",
		bb_sync_status: "synced",
	}),
];

const noop = async () => {};

const meta = {
	title: "Features/ReimbursementReviewQueue",
	component: ReimbursementReviewQueue,
	parameters: { layout: "padded" },
	args: {
		requests,
		selectedIds: new Set<string>(),
		onSelectionChange: () => {},
		isReviewing: false,
		rejectionReasons: {},
		onReasonChange: () => {},
		onReview: noop,
		onDepartmentChange: noop,
		financeProjects: [],
		financePlanItems: [],
		financePostings: [],
		onFinanceLinksChange: noop,
		isUpdatingFinanceLinks: false,
		hasBulkDownload: true,
		isUpdatingDepartment: false,
		onReceiptOpen: noop,
		buchhaltungsButlerSyncStatus: null,
		isLoadingBuchhaltungsButlerSyncStatus: false,
		hasBuchhaltungsButlerSyncStatusError: false,
		onBuchhaltungsButlerSync: noop,
		isSyncingBuchhaltungsButler: false,
	},
} satisfies Meta<typeof ReimbursementReviewQueue>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
