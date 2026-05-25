import { createSign } from "node:crypto";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const GITHUB_API_BASE_URL = "https://api.github.com";
const DEFAULT_BUG_REPORT_GITHUB_OWNER = "tum-ai";
const DEFAULT_BUG_REPORT_GITHUB_REPO = "member-manager";
const GITHUB_API_VERSION = "2022-11-28";
const USER_AGENT = "member-manager";
const INSTALLATION_TOKEN_REFRESH_BUFFER_MS = 60_000;

export interface BugReportIssuePayload {
	reporterUserId: string;
	reporterEmail: string;
	message: string;
	stepsToReproduce?: string;
	pageUrl?: string;
	userAgent?: string;
}

export interface BugReportAssignee {
	githubUsername: string;
	slackId?: string;
}

export interface BugReportIssue {
	number: number;
	url: string;
	title: string;
	assignee?: BugReportAssignee;
	assignmentError?: string;
}

interface GitHubConfig {
	appId: string;
	installationId: string;
	privateKey: string;
	owner: string;
	repo: string;
	labels: string[];
}

type BugReportIssueCreator = (
	payload: BugReportIssuePayload,
) => Promise<BugReportIssue>;

let cachedInstallationToken: {
	cacheKey: string;
	token: string;
	expiresAtMs: number;
} | null = null;

function parseCsv(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseBugReportAssigneesJson(value: string): BugReportAssignee[] {
	const parsed = JSON.parse(value) as unknown;
	if (!Array.isArray(parsed)) {
		throw new Error("BUG_REPORT_ASSIGNEES_JSON must be a JSON array");
	}

	return parsed.map((item, index) => {
		if (!item || typeof item !== "object") {
			throw new Error(
				`BUG_REPORT_ASSIGNEES_JSON item ${index + 1} must be an object`,
			);
		}

		const record = item as Record<string, unknown>;
		const githubUsername =
			typeof record.github === "string"
				? record.github.trim()
				: typeof record.githubUsername === "string"
					? record.githubUsername.trim()
					: "";
		const slackId =
			typeof record.slackId === "string" ? record.slackId.trim() : "";

		if (!githubUsername) {
			throw new Error(
				`BUG_REPORT_ASSIGNEES_JSON item ${index + 1} is missing github`,
			);
		}

		return {
			githubUsername,
			...(slackId ? { slackId } : {}),
		};
	});
}

function getBugReportAssignees(): BugReportAssignee[] {
	const jsonAssignees = process.env.BUG_REPORT_ASSIGNEES_JSON?.trim();
	if (jsonAssignees) {
		return parseBugReportAssigneesJson(jsonAssignees);
	}

	const githubUsernames = parseCsv(process.env.BUG_REPORT_GITHUB_ASSIGNEES);
	const slackIds = parseCsv(process.env.BUG_REPORT_SLACK_ASSIGNEES);

	return githubUsernames.map((githubUsername, index) => ({
		githubUsername,
		...(slackIds[index] ? { slackId: slackIds[index] } : {}),
	}));
}

function selectBugReportAssignee(
	issueNumber: number,
	assignees = getBugReportAssignees(),
): BugReportAssignee | undefined {
	if (assignees.length === 0) {
		return undefined;
	}

	return assignees[(issueNumber - 1) % assignees.length];
}

function parseRepository(value: string | undefined): {
	owner?: string;
	repo?: string;
} {
	const [owner, repo] = (value ?? "").split("/").map((part) => part.trim());
	return owner && repo ? { owner, repo } : {};
}

function getGitHubAppPrivateKey(): string {
	const base64PrivateKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64?.trim();
	if (base64PrivateKey) {
		return Buffer.from(base64PrivateKey, "base64").toString("utf8").trim();
	}

	return (process.env.GITHUB_APP_PRIVATE_KEY ?? "")
		.replace(/\\n/g, "\n")
		.trim();
}

function getGitHubConfig(): GitHubConfig {
	const appId = process.env.GITHUB_APP_ID?.trim() ?? "";
	const installationId = process.env.GITHUB_APP_INSTALLATION_ID?.trim() ?? "";
	const privateKey = getGitHubAppPrivateKey();
	const configuredRepository = parseRepository(
		process.env.BUG_REPORT_GITHUB_REPOSITORY ?? process.env.GITHUB_REPOSITORY,
	);
	const owner =
		process.env.BUG_REPORT_GITHUB_OWNER?.trim() ||
		configuredRepository.owner ||
		DEFAULT_BUG_REPORT_GITHUB_OWNER;
	const repo =
		process.env.BUG_REPORT_GITHUB_REPO?.trim() ||
		configuredRepository.repo ||
		DEFAULT_BUG_REPORT_GITHUB_REPO;

	const missing = [
		["GITHUB_APP_ID", appId],
		["GITHUB_APP_INSTALLATION_ID", installationId],
		["GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_BASE64", privateKey],
	]
		.filter(([, value]) => !value)
		.map(([name]) => name);

	if (missing.length > 0) {
		throw new Error(
			`GitHub App configuration is incomplete. Missing: ${missing.join(", ")}`,
		);
	}

	return {
		appId,
		installationId,
		privateKey,
		owner,
		repo,
		labels: parseCsv(process.env.BUG_REPORT_GITHUB_LABELS),
	};
}

function base64UrlJson(value: Record<string, unknown>): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createGitHubAppJwt(config: GitHubConfig): string {
	const nowSeconds = Math.floor(Date.now() / 1000);
	const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
	const payload = base64UrlJson({
		iat: nowSeconds - 60,
		exp: nowSeconds + 9 * 60,
		iss: config.appId,
	});
	const unsignedToken = `${header}.${payload}`;
	const signer = createSign("RSA-SHA256");
	signer.update(unsignedToken);
	signer.end();
	const signature = signer.sign(config.privateKey).toString("base64url");

	return `${unsignedToken}.${signature}`;
}

async function readResponseBody(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}

async function githubFetch<T>(
	path: string,
	init: RequestInit & { token: string },
): Promise<T> {
	const { token, headers, ...rest } = init;
	const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}${path}`, {
		...rest,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"User-Agent": USER_AGENT,
			"X-GitHub-Api-Version": GITHUB_API_VERSION,
			...headers,
		},
	});

	if (!response.ok) {
		const body = (await readResponseBody(response)).slice(0, 500);
		throw new Error(
			`GitHub API request failed with ${response.status}${body ? `: ${body}` : ""}`,
		);
	}

	return (await response.json()) as T;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function getInstallationAccessToken(
	config: GitHubConfig,
): Promise<string> {
	const cacheKey = `${config.appId}:${config.installationId}`;
	if (
		cachedInstallationToken?.cacheKey === cacheKey &&
		cachedInstallationToken.expiresAtMs >
			Date.now() + INSTALLATION_TOKEN_REFRESH_BUFFER_MS
	) {
		return cachedInstallationToken.token;
	}

	const jwt = createGitHubAppJwt(config);
	const response = await githubFetch<{ token?: string; expires_at?: string }>(
		`/app/installations/${encodeURIComponent(
			config.installationId,
		)}/access_tokens`,
		{
			method: "POST",
			token: jwt,
		},
	);

	if (!response.token || !response.expires_at) {
		throw new Error("GitHub installation token response was incomplete");
	}

	cachedInstallationToken = {
		cacheKey,
		token: response.token,
		expiresAtMs: Date.parse(response.expires_at),
	};

	return response.token;
}

async function assignGitHubIssue(
	config: GitHubConfig,
	token: string,
	issueNumber: number,
	assignee: BugReportAssignee,
): Promise<void> {
	await githubFetch<unknown>(
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
			config.repo,
		)}/issues/${issueNumber}/assignees`,
		{
			method: "POST",
			token,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ assignees: [assignee.githubUsername] }),
		},
	);
}

function sanitizeCodeBlockText(value: string): string {
	return value.trim().replace(/@/g, "@\u200b").replace(/```/g, "`\u200b``");
}

function inlineCode(value: string): string {
	return `\`${value.trim().replace(/`/g, "`\u200b").replace(/@/g, "@\u200b")}\``;
}

function codeBlock(value: string): string {
	return `\`\`\`\n${sanitizeCodeBlockText(value)}\n\`\`\``;
}

function truncate(value: string, maxLength: number): string {
	return value.length > maxLength
		? `${value.slice(0, maxLength - 1).trimEnd()}…`
		: value;
}

function buildBugReportIssueTitle(payload: BugReportIssuePayload): string {
	const summary =
		payload.message
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find(Boolean)
			?.replace(/\s+/g, " ") ?? "Bug report";

	return truncate(`Bug: ${summary}`, 100);
}

function optionalContextLine(
	label: string,
	value: string | undefined,
): string[] {
	return value?.trim() ? [`- ${label}: ${inlineCode(value)}`] : [];
}

function buildBugReportIssueBody(payload: BugReportIssuePayload): string {
	const reporter = payload.reporterEmail || payload.reporterUserId;

	return [
		"## What happened",
		codeBlock(payload.message),
		payload.stepsToReproduce
			? ["## Steps to reproduce", codeBlock(payload.stepsToReproduce)].join(
					"\n\n",
				)
			: undefined,
		"## Context",
		[
			`- Reporter: ${inlineCode(reporter)}`,
			`- User ID: ${inlineCode(payload.reporterUserId)}`,
			...optionalContextLine("Page", payload.pageUrl),
			...optionalContextLine("User agent", payload.userAgent),
			`- Reported at: ${inlineCode(new Date().toISOString())}`,
			"- Source: `Member Manager footer bug report`",
		].join("\n"),
	]
		.filter((section): section is string => Boolean(section))
		.join("\n\n");
}

async function defaultBugReportIssueCreator(
	payload: BugReportIssuePayload,
): Promise<BugReportIssue> {
	const config = getGitHubConfig();
	const token = await getInstallationAccessToken(config);
	const title = buildBugReportIssueTitle(payload);
	const body = buildBugReportIssueBody(payload);
	const issue = await githubFetch<{
		number?: number;
		html_url?: string;
		title?: string;
	}>(
		`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
			config.repo,
		)}/issues`,
		{
			method: "POST",
			token,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				title,
				body,
				...(config.labels.length > 0 ? { labels: config.labels } : {}),
			}),
		},
	);

	if (!issue.number || !issue.html_url) {
		throw new Error("GitHub issue response was incomplete");
	}

	const selectedAssignee = selectBugReportAssignee(issue.number);
	let assignedAssignee: BugReportAssignee | undefined;
	let assignmentError: string | undefined;
	if (selectedAssignee) {
		try {
			await assignGitHubIssue(config, token, issue.number, selectedAssignee);
			assignedAssignee = selectedAssignee;
		} catch (error) {
			assignmentError = errorMessage(error);
		}
	}

	return {
		number: issue.number,
		url: issue.html_url,
		title: issue.title ?? title,
		...(assignedAssignee ? { assignee: assignedAssignee } : {}),
		...(assignmentError ? { assignmentError } : {}),
	};
}

let activeBugReportIssueCreator: BugReportIssueCreator =
	defaultBugReportIssueCreator;

export async function createBugReportIssue(
	payload: BugReportIssuePayload,
): Promise<BugReportIssue> {
	return activeBugReportIssueCreator(payload);
}

export function setBugReportIssueCreator(creator: BugReportIssueCreator): void {
	activeBugReportIssueCreator = creator;
}

export function resetBugReportIssueCreator(): void {
	activeBugReportIssueCreator = defaultBugReportIssueCreator;
	cachedInstallationToken = null;
}
