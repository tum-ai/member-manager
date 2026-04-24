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

type SlackNotifier = (
	payload: EngagementCertificateSlackNotification,
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

export async function notifyAdminsOfCertificateRequest(
	payload: EngagementCertificateSlackNotification,
): Promise<void> {
	await activeSlackNotifier(payload);
}

export function setSlackNotifier(notifier: SlackNotifier): void {
	activeSlackNotifier = notifier;
}

export function resetSlackNotifier(): void {
	activeSlackNotifier = defaultSlackNotifier;
	cachedAdminEmails = null;
}
