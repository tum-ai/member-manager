import { getAuthEmail } from "./authEmails.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";
import { isLocalAdminBootstrapEnabled } from "./localAdmin.js";
import { getSupabase } from "./supabase.js";

const SLACK_API_BASE_URL = "https://slack.com/api";
const ADMIN_EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BUG_REPORT_SLACK_CHANNEL_ID = "C0B3YGL3XS5";

let cachedAdminEmails: {
	emails: string[];
	expiresAt: number;
} | null = null;
let cachedSlackBotUserId: string | null | undefined;

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

export interface BugReportSlackNotification {
	issueNumber: number;
	issueUrl: string;
	issueTitle: string;
	assigneeSlackId?: string;
}

type SlackBlock = Record<string, unknown>;

type SlackNotifier = (
	payload: EngagementCertificateSlackNotification,
) => Promise<void>;

type ReimbursementSlackNotifier = (
	payload: ReimbursementSlackNotification,
) => Promise<void>;

type ReimbursementStatusSlackNotifier = (
	payload: ReimbursementStatusSlackNotification,
) => Promise<void>;

type BugReportSlackNotifier = (
	payload: BugReportSlackNotification,
) => Promise<void>;

function selectRoundRobinSlackMember(
	issueNumber: number,
	memberIds: string[],
): string | undefined {
	const sortedMemberIds = [...new Set(memberIds)].sort();
	if (sortedMemberIds.length === 0) {
		return undefined;
	}

	return sortedMemberIds[(issueNumber - 1) % sortedMemberIds.length];
}

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
	body: Record<string, string> = {},
): Promise<T> {
	const token = process.env.SLACK_BOT_TOKEN;
	if (!token) {
		return {} as T;
	}

	const response = await fetchWithTimeout(`${SLACK_API_BASE_URL}${path}`, {
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

async function getSlackBotUserId(): Promise<string | null> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return null;
	}
	if (cachedSlackBotUserId !== undefined) {
		return cachedSlackBotUserId;
	}

	const response = await slackApi<{
		ok?: boolean;
		error?: string;
		user_id?: string;
	}>("/auth.test");

	if (!response.ok) {
		throw new Error(response.error || "Slack auth test failed");
	}

	cachedSlackBotUserId = response.user_id ?? null;
	return cachedSlackBotUserId;
}

async function fetchSlackConversationMemberIds(
	channel: string,
): Promise<string[]> {
	const members: string[] = [];
	let cursor = "";

	do {
		const response = await slackApi<{
			ok?: boolean;
			error?: string;
			members?: string[];
			response_metadata?: { next_cursor?: string };
		}>("/conversations.members", {
			channel,
			limit: "1000",
			...(cursor ? { cursor } : {}),
		});

		if (!response.ok) {
			throw new Error(
				response.error || `Slack channel member lookup failed for ${channel}`,
			);
		}

		members.push(...(response.members ?? []));
		cursor = response.response_metadata?.next_cursor ?? "";
	} while (cursor);

	const botUserId = await getSlackBotUserId();
	return members.filter((memberId) => memberId && memberId !== botUserId);
}

async function selectBugReportSlackChannelMember(
	issueNumber: number,
	channel: string,
): Promise<string | undefined> {
	return selectRoundRobinSlackMember(
		issueNumber,
		await fetchSlackConversationMemberIds(channel),
	);
}

export async function getSlackUserEmailById(
	userId: string,
): Promise<string | null> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return null;
	}

	const response = await slackApi<{
		ok?: boolean;
		error?: string;
		user?: { profile?: { email?: string } };
	}>("/users.info", { user: userId });

	if (!response.ok) {
		throw new Error(response.error || `Slack user lookup failed for ${userId}`);
	}

	return response.user?.profile?.email ?? null;
}

export async function lookupSlackUserIdByEmail(
	email: string,
): Promise<string | null> {
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

async function openDirectMessageChannel(userId: string): Promise<string> {
	const response = await slackApi<{
		ok?: boolean;
		error?: string;
		channel?: { id?: string };
	}>("/conversations.open", { users: userId });

	if (!response.ok || !response.channel?.id) {
		throw new Error(response.error || `Slack DM open failed for ${userId}`);
	}

	return response.channel.id;
}

async function postSlackMessage(
	channel: string,
	text: string,
	blocks?: SlackBlock[],
): Promise<void> {
	const token = process.env.SLACK_BOT_TOKEN;
	if (!token) {
		throw new Error("SLACK_BOT_TOKEN is not configured");
	}

	const response = await fetchWithTimeout(
		`${SLACK_API_BASE_URL}/chat.postMessage`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"content-type": "application/json; charset=utf-8",
			},
			body: JSON.stringify({
				channel,
				text,
				unfurl_links: false,
				unfurl_media: false,
				...(blocks ? { blocks } : {}),
			}),
		},
	);

	if (!response.ok) {
		throw new Error(`Slack message failed with ${response.status}`);
	}

	const json = (await response.json()) as { ok?: boolean; error?: string };
	if (!json.ok) {
		throw new Error(json.error || `Slack message failed for ${channel}`);
	}
}

export async function postDirectMessage(
	userId: string,
	text: string,
	blocks?: Record<string, unknown>[],
): Promise<void> {
	const channel = await openDirectMessageChannel(userId);
	await postSlackMessage(channel, text, blocks);
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

	const adminUserIds = new Set(
		(adminRows ?? [])
			.map((row) => String((row as { user_id?: unknown }).user_id ?? ""))
			.filter(Boolean),
	);

	const { data: optedInRows, error: optedInError } = await getSupabase()
		.from("members")
		.select(
			"user_id, department, member_status, reimbursement_slack_notifications_enabled",
		)
		.eq("reimbursement_slack_notifications_enabled", true);

	if (optedInError) {
		throw new Error(
			`Failed to fetch reimbursement Slack opt-ins: ${optedInError.message}`,
		);
	}

	const userIds = new Set<string>();
	for (const row of optedInRows ?? []) {
		const userId = String((row as { user_id?: unknown }).user_id ?? "");
		const isAdmin = adminUserIds.has(userId);
		const isActiveFinanceMember =
			(row as { department?: unknown }).department === "Legal & Finance" &&
			(row as { member_status?: unknown }).member_status === "active";
		if (userId && (isAdmin || isActiveFinanceMember)) {
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

function buildReimbursementBlocks(
	payload: ReimbursementSlackNotification,
): SlackBlock[] | undefined {
	if (!payload.reviewUrl) {
		return undefined;
	}

	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*New ${payload.submissionType} request*\n${payload.amount.toFixed(
					2,
				)} EUR · ${payload.department}`,
			},
		},
		{
			type: "section",
			fields: [
				{ type: "mrkdwn", text: `*Requester*\n${payload.requesterEmail}` },
				{ type: "mrkdwn", text: `*Request ID*\n${payload.requestId}` },
			],
		},
		{
			type: "actions",
			block_id: `reimbursement_${payload.requestId}_actions`,
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "Open finance review" },
					url: payload.reviewUrl,
					action_id: "open_reimbursement_review",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "Approve" },
					value: payload.requestId,
					action_id: "reimbursement_approve",
					style: "primary",
					confirm: {
						title: { type: "plain_text", text: "Approve request?" },
						text: {
							type: "mrkdwn",
							text: "This approves the reimbursement in Member Manager.",
						},
						confirm: { type: "plain_text", text: "Approve" },
						deny: { type: "plain_text", text: "Cancel" },
					},
				},
				{
					type: "button",
					text: { type: "plain_text", text: "Approve & sync BB" },
					value: payload.requestId,
					action_id: "reimbursement_approve_sync_bb",
					confirm: {
						title: { type: "plain_text", text: "Approve and sync?" },
						text: {
							type: "mrkdwn",
							text: "This approves the request and uploads the receipt to BuchhaltungsButler.",
						},
						confirm: { type: "plain_text", text: "Approve & sync" },
						deny: { type: "plain_text", text: "Cancel" },
					},
				},
			],
		},
	];
}

function buildReimbursementStatusBlocks(
	payload: ReimbursementStatusSlackNotification,
): SlackBlock[] | undefined {
	if (!payload.requestUrl) {
		return undefined;
	}

	return [
		{
			type: "actions",
			block_id: `reimbursement_${payload.requestId}_status_actions`,
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "Open reimbursement tool" },
					url: payload.requestUrl,
					action_id: "open_reimbursement_tool",
				},
			],
		},
	];
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

function getBugReportSlackChannelId(): string {
	return (
		process.env.BUG_REPORT_SLACK_CHANNEL_ID?.trim() ||
		DEFAULT_BUG_REPORT_SLACK_CHANNEL_ID
	);
}

function sanitizeSlackUserText(value: string, maxLength = 1800): string {
	const trimmed = value.trim();
	const truncated =
		trimmed.length > maxLength
			? `${trimmed.slice(0, maxLength - 1)}…`
			: trimmed;

	return truncated
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/@/g, `@\u200b`)
		.replace(/```/g, "`\u200b``");
}

function buildBugReportAssigneeLine(
	payload: BugReportSlackNotification,
): string {
	return payload.assigneeSlackId ? `<@${payload.assigneeSlackId}>` : "_no one_";
}

function buildBugReportMessage(payload: BugReportSlackNotification): string {
	return [
		`🐛 New bug report created: #${payload.issueNumber}`,
		buildBugReportAssigneeLine(payload),
		payload.issueUrl,
	].join("\n");
}

function buildBugReportBlocks(
	payload: BugReportSlackNotification,
): SlackBlock[] {
	return [
		{
			type: "header",
			text: { type: "plain_text", text: "🐛 New bug report created" },
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Issue*\n<${payload.issueUrl}|#${
					payload.issueNumber
				} ${sanitizeSlackUserText(payload.issueTitle, 120)}>`,
			},
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: buildBugReportAssigneeLine(payload),
			},
		},
	];
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
let activeBugReportSlackNotifier: BugReportSlackNotifier =
	defaultBugReportSlackNotifier;

async function defaultReimbursementSlackNotifier(
	payload: ReimbursementSlackNotification,
): Promise<void> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return;
	}

	const reviewerEmails = await fetchReimbursementReviewerEmails();
	const message = buildReimbursementMessage(payload);
	const blocks = buildReimbursementBlocks(payload);
	await Promise.all(
		reviewerEmails.map(async (reviewerEmail) => {
			const slackUserId = await lookupSlackUserIdByEmail(reviewerEmail);
			if (!slackUserId) {
				return;
			}
			await postDirectMessage(slackUserId, message, blocks);
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
		buildReimbursementStatusBlocks(payload),
	);
}

async function defaultBugReportSlackNotifier(
	payload: BugReportSlackNotification,
): Promise<void> {
	if (!process.env.SLACK_BOT_TOKEN) {
		return;
	}

	const channel = getBugReportSlackChannelId();
	let assigneeSlackId = payload.assigneeSlackId;

	if (!assigneeSlackId) {
		assigneeSlackId = await selectBugReportSlackChannelMember(
			payload.issueNumber,
			channel,
		);
	}

	const notification = { ...payload, assigneeSlackId };
	await postSlackMessage(
		channel,
		buildBugReportMessage(notification),
		buildBugReportBlocks(notification),
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

export async function notifyBugReport(
	payload: BugReportSlackNotification,
): Promise<void> {
	await activeBugReportSlackNotifier(payload);
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

export function setBugReportSlackNotifier(
	notifier: BugReportSlackNotifier,
): void {
	activeBugReportSlackNotifier = notifier;
}

// Local/dev-only: replace the bug-report Slack notifier with a no-op so a real
// `SLACK_BOT_TOKEN` in `server/.env.local` can't push the stubbed
// `local.invalid` issue (see `installLocalBugReportStub`) to the production
// channel. Self-guards on `isLocalAdminBootstrapEnabled()` (defense in depth);
// the gate is injected so tests cover both branches without mutating
// `process.env` in the concurrent test runner.
export function installLocalBugReportSlackStub(
	isLocalStack: boolean = isLocalAdminBootstrapEnabled(),
): void {
	if (!isLocalStack) return;
	setBugReportSlackNotifier(async () => {});
}

export function resetSlackNotifier(): void {
	activeSlackNotifier = defaultSlackNotifier;
	activeReimbursementSlackNotifier = defaultReimbursementSlackNotifier;
	activeReimbursementStatusSlackNotifier =
		defaultReimbursementStatusSlackNotifier;
	activeBugReportSlackNotifier = defaultBugReportSlackNotifier;
	cachedAdminEmails = null;
	cachedSlackBotUserId = undefined;
}
