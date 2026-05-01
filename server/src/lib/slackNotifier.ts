import { getAuthEmail } from "./authEmails.js";
import { getSupabase } from "./supabase.js";

const SLACK_API_BASE_URL = "https://slack.com/api";
const ADMIN_EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedAdminEmails: {
	emails: string[];
	expiresAt: number;
} | null = null;

export interface EngagementCertificateSlackNotification {
	requestId: string;
	requesterUserId: string;
	requesterEmail: string;
	requesterName: string;
	adminReviewUrl?: string;
}

export interface ReimbursementSlackNotification {
	requestId: string;
	requesterUserId: string;
	requesterEmail: string;
	submissionType: string;
	department: string;
	amount: number;
	reviewUrl?: string;
}

export interface ReimbursementStatusSlackNotification {
	requestId: string;
	requesterUserId: string;
	requesterEmail: string;
	submissionType: string;
	amount: number;
	statusType: "approval" | "payment";
	statusValue: "approved" | "not_approved" | "paid";
	rejectionReason?: string;
	requestUrl?: string;
}

type SlackNotifier = (
	payload: EngagementCertificateSlackNotification,
) => Promise<void>;

type ReimbursementSlackNotifier = (
	payload: ReimbursementSlackNotification,
) => Promise<void>;

type ReimbursementStatusSlackNotifier = (
	payload: ReimbursementStatusSlackNotification,
) => Promise<void>;

async function fetchAdminEmails(): Promise<string[]> {
	if (cachedAdminEmails && cachedAdminEmails.expiresAt > Date.now()) {
		return [...cachedAdminEmails.emails];
	}

	const { data, error } = await getSupabase()
		.from("user_roles")
		.select("user_id")
		.eq("role", "admin");

	if (error) {
		throw new Error(`Failed to fetch admin roles: ${error.message}`);
	}

	const userIds = (data ?? [])
		.map((row) => String((row as { user_id?: unknown }).user_id ?? ""))
		.filter(Boolean);
	const emails = await Promise.all(
		userIds.map((userId) => getAuthEmail(userId)),
	);
	const resolvedEmails = emails
		.map((email) => email.trim())
		.filter((email) => email !== "");

	cachedAdminEmails = {
		emails: resolvedEmails,
		expiresAt: Date.now() + ADMIN_EMAIL_CACHE_TTL_MS,
	};

	return [...resolvedEmails];
}

async function slackApi<T>(
	path: string,
	body: Record<string, string>,
): Promise<T> {
	const token = process.env.SLACK_BOT_TOKEN;
	if (!token) {
		return {} as T;
	}

	const response = await fetch(`${SLACK_API_BASE_URL}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams(body),
	});

	if (!response.ok) {
		throw new Error(`Slack API request failed with ${response.status}`);
	}

	return (await response.json()) as T;
}

async function lookupSlackUserIdByEmail(email: string): Promise<string | null> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return null;
	}

	const response = await slackApi<{
		ok?: boolean;
		error?: string;
		user?: { id?: string };
	}>("/users.lookupByEmail", { email });

	if (!response.ok) {
		throw new Error(response.error || `Slack lookup failed for ${email}`);
	}

	return response.user?.id ?? null;
}

async function postDirectMessage(channel: string, text: string): Promise<void> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return;
	}

	const response = await fetch(`${SLACK_API_BASE_URL}/chat.postMessage`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
			"content-type": "application/json; charset=utf-8",
		},
		body: JSON.stringify({
			channel,
			text,
		}),
	});

	if (!response.ok) {
		throw new Error(`Slack message failed with ${response.status}`);
	}

	const json = (await response.json()) as { ok?: boolean; error?: string };
	if (!json.ok) {
		throw new Error(json.error || `Slack message failed for ${channel}`);
	}
}

function buildMessage(payload: EngagementCertificateSlackNotification): string {
	const reviewLine = payload.adminReviewUrl
		? `Review in Member Manager: ${payload.adminReviewUrl}`
		: "Review in the Member Manager admin workspace.";

	return [
		"New engagement certificate request",
		`Member: ${payload.requesterName || payload.requesterEmail}`,
		`Email: ${payload.requesterEmail}`,
		`Request ID: ${payload.requestId}`,
		reviewLine,
	].join("\n");
}

async function fetchReimbursementReviewerEmails(): Promise<string[]> {
	const { data: adminRows, error: adminError } = await getSupabase()
		.from("user_roles")
		.select("user_id")
		.eq("role", "admin");

	if (adminError) {
		throw new Error(`Failed to fetch admin roles: ${adminError.message}`);
	}

	const { data: financeRows, error: financeError } = await getSupabase()
		.from("members")
		.select("user_id")
		.eq("department", "Legal & Finance")
		.eq("member_status", "active");

	if (financeError) {
		throw new Error(`Failed to fetch finance members: ${financeError.message}`);
	}

	const userIds = new Set<string>();
	for (const row of [...(adminRows ?? []), ...(financeRows ?? [])]) {
		const userId = String((row as { user_id?: unknown }).user_id ?? "");
		if (userId) {
			userIds.add(userId);
		}
	}

	const emails = await Promise.all(
		[...userIds].map((userId) => getAuthEmail(userId)),
	);
	return emails.map((email) => email.trim()).filter(Boolean);
}

function buildReimbursementMessage(
	payload: ReimbursementSlackNotification,
): string {
	const reviewLine = payload.reviewUrl
		? `Review in Member Manager: ${payload.reviewUrl}`
		: "Review in the Member Manager finance workspace.";

	return [
		`New ${payload.submissionType} request`,
		`Requester: ${payload.requesterEmail}`,
		`Department: ${payload.department}`,
		`Amount: ${payload.amount.toFixed(2)} EUR`,
		`Request ID: ${payload.requestId}`,
		reviewLine,
	].join("\n");
}

function buildReimbursementStatusMessage(
	payload: ReimbursementStatusSlackNotification,
): string {
	const requestLabel = payload.submissionType || "reimbursement";
	const requestLine = payload.requestUrl
		? `View in Member Manager: ${payload.requestUrl}`
		: "View it in Member Manager.";

	if (payload.statusType === "payment") {
		return [
			`Your ${requestLabel} request was marked as paid`,
			`Amount: ${payload.amount.toFixed(2)} EUR`,
			`Request ID: ${payload.requestId}`,
			requestLine,
		].join("\n");
	}

	if (payload.statusValue === "not_approved") {
		return [
			`Your ${requestLabel} request was rejected`,
			`Amount: ${payload.amount.toFixed(2)} EUR`,
			`Reason: ${payload.rejectionReason || "No reason provided"}`,
			`Request ID: ${payload.requestId}`,
			requestLine,
		].join("\n");
	}

	return [
		`Your ${requestLabel} request was approved`,
		`Amount: ${payload.amount.toFixed(2)} EUR`,
		"Legal & Finance will mark it paid after payout.",
		`Request ID: ${payload.requestId}`,
		requestLine,
	].join("\n");
}

async function defaultSlackNotifier(
	payload: EngagementCertificateSlackNotification,
): Promise<void> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return;
	}

	const adminEmails = await fetchAdminEmails();
	const message = buildMessage(payload);
	await Promise.all(
		adminEmails.map(async (adminEmail) => {
			const slackUserId = await lookupSlackUserIdByEmail(adminEmail);
			if (!slackUserId) {
				return;
			}
			await postDirectMessage(slackUserId, message);
		}),
	);
}

let activeSlackNotifier: SlackNotifier = defaultSlackNotifier;
let activeReimbursementSlackNotifier: ReimbursementSlackNotifier =
	defaultReimbursementSlackNotifier;
let activeReimbursementStatusSlackNotifier: ReimbursementStatusSlackNotifier =
	defaultReimbursementStatusSlackNotifier;

async function defaultReimbursementSlackNotifier(
	payload: ReimbursementSlackNotification,
): Promise<void> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return;
	}

	const reviewerEmails = await fetchReimbursementReviewerEmails();
	const message = buildReimbursementMessage(payload);
	await Promise.all(
		reviewerEmails.map(async (reviewerEmail) => {
			const slackUserId = await lookupSlackUserIdByEmail(reviewerEmail);
			if (!slackUserId) {
				return;
			}
			await postDirectMessage(slackUserId, message);
		}),
	);
}

async function defaultReimbursementStatusSlackNotifier(
	payload: ReimbursementStatusSlackNotification,
): Promise<void> {
	if (!process.env.SLACK_BOT_TOKEN || !payload.requesterEmail) {
		return;
	}

	const slackUserId = await lookupSlackUserIdByEmail(payload.requesterEmail);
	if (!slackUserId) {
		return;
	}

	await postDirectMessage(
		slackUserId,
		buildReimbursementStatusMessage(payload),
	);
}

export async function notifyAdminsOfCertificateRequest(
	payload: EngagementCertificateSlackNotification,
): Promise<void> {
	await activeSlackNotifier(payload);
}

export async function notifyFinanceOfReimbursementRequest(
	payload: ReimbursementSlackNotification,
): Promise<void> {
	await activeReimbursementSlackNotifier(payload);
}

export async function notifyRequesterOfReimbursementStatus(
	payload: ReimbursementStatusSlackNotification,
): Promise<void> {
	await activeReimbursementStatusSlackNotifier(payload);
}

export function setSlackNotifier(notifier: SlackNotifier): void {
	activeSlackNotifier = notifier;
}

export function setReimbursementSlackNotifier(
	notifier: ReimbursementSlackNotifier,
): void {
	activeReimbursementSlackNotifier = notifier;
}

export function setReimbursementStatusSlackNotifier(
	notifier: ReimbursementStatusSlackNotifier,
): void {
	activeReimbursementStatusSlackNotifier = notifier;
}

export function resetSlackNotifier(): void {
	activeSlackNotifier = defaultSlackNotifier;
	activeReimbursementSlackNotifier = defaultReimbursementSlackNotifier;
	activeReimbursementStatusSlackNotifier =
		defaultReimbursementStatusSlackNotifier;
	cachedAdminEmails = null;
}
