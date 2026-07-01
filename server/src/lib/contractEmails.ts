interface ContractPartnerEmailPayload {
	to: string;
	partnerCompanyName: string;
	signingUrl: string;
	customMessage?: string | null;
	subject?: string | null;
}

interface ContractClarificationEmailPayload {
	to: string;
	partnerCompanyName?: string | null;
	submissionUrl: string;
	message?: string | null;
}

interface ContractStatusChangeEmailPayload {
	to: string;
	partnerCompanyName?: string | null;
	submissionUrl: string;
	fromStatus: string | null;
	toStatus: string;
	/** Optional context, e.g. a rejection reason or clarification note. */
	note?: string | null;
	/** Tailors the intro for the legal team vs. the contract creator. */
	audience: "legal" | "creator";
}

function requiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is not configured`);
	}
	return value;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function isContractEmailConfigured(): boolean {
	return Boolean(
		process.env.RESEND_API_KEY?.trim() &&
			process.env.CONTRACT_EMAIL_FROM?.trim(),
	);
}

/** Legal-team notification recipient, or null when unconfigured. */
export function getContractLegalEmail(): string | null {
	return process.env.CONTRACT_LEGAL_EMAIL?.trim() || null;
}

/** Human-readable status label, e.g. "sent_to_partner" -> "Sent to partner". */
export function formatContractStatusLabel(status: string | null): string {
	if (!status) return "—";
	const spaced = status.replace(/_/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function sendContractPartnerEmail(
	payload: ContractPartnerEmailPayload,
): Promise<void> {
	const apiKey = requiredEnv("RESEND_API_KEY");
	const from = requiredEnv("CONTRACT_EMAIL_FROM");
	const subject =
		payload.subject?.trim() ||
		`TUM.ai contract for ${payload.partnerCompanyName || "signature"}`;
	const message =
		payload.customMessage?.trim() ||
		"Please review and sign the contract using the secure link below.";
	const text = [
		`Hi ${payload.partnerCompanyName || "there"},`,
		"",
		message,
		"",
		payload.signingUrl,
		"",
		"Best regards",
		"TUM.ai",
	].join("\n");
	const html = [
		`<p>Hi ${escapeHtml(payload.partnerCompanyName || "there")},</p>`,
		`<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
		`<p><a href="${escapeHtml(payload.signingUrl)}">Review and sign the contract</a></p>`,
		"<p>Best regards<br>TUM.ai</p>",
	].join("");

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: payload.to,
			subject,
			text,
			html,
		}),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`Failed to send contract email (${response.status}): ${
				detail || response.statusText
			}`,
		);
	}
}

export async function sendContractClarificationEmail(
	payload: ContractClarificationEmailPayload,
): Promise<void> {
	const apiKey = requiredEnv("RESEND_API_KEY");
	const from = requiredEnv("CONTRACT_EMAIL_FROM");
	const partnerName = payload.partnerCompanyName?.trim() || "the partner";
	const message =
		payload.message?.trim() ||
		"Please review the contract draft and provide the requested clarification.";
	const subject = `Clarification requested for ${partnerName}`;
	const text = [
		"Hi,",
		"",
		`A clarification was requested for the contract with ${partnerName}.`,
		"",
		message,
		"",
		payload.submissionUrl,
		"",
		"Best regards",
		"TUM.ai",
	].join("\n");
	const html = [
		"<p>Hi,</p>",
		`<p>A clarification was requested for the contract with ${escapeHtml(partnerName)}.</p>`,
		`<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
		`<p><a href="${escapeHtml(payload.submissionUrl)}">Open contract submission</a></p>`,
		"<p>Best regards<br>TUM.ai</p>",
	].join("");

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: payload.to,
			subject,
			text,
			html,
		}),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`Failed to send contract clarification email (${response.status}): ${
				detail || response.statusText
			}`,
		);
	}
}

export async function sendContractStatusChangeEmail(
	payload: ContractStatusChangeEmailPayload,
): Promise<void> {
	const apiKey = requiredEnv("RESEND_API_KEY");
	const from = requiredEnv("CONTRACT_EMAIL_FROM");
	const partnerName = payload.partnerCompanyName?.trim() || "the partner";
	const fromLabel = formatContractStatusLabel(payload.fromStatus);
	const toLabel = formatContractStatusLabel(payload.toStatus);
	const intro =
		payload.audience === "creator"
			? `The status of your contract with ${partnerName} changed from "${fromLabel}" to "${toLabel}".`
			: `A contract with ${partnerName} changed status from "${fromLabel}" to "${toLabel}".`;
	const subject = `Contract ${partnerName}: ${toLabel}`;
	const noteLine = payload.note?.trim() ? [payload.note.trim(), ""] : [];
	const text = [
		"Hi,",
		"",
		intro,
		"",
		...noteLine,
		payload.submissionUrl,
		"",
		"Best regards",
		"TUM.ai",
	].join("\n");
	const html = [
		"<p>Hi,</p>",
		`<p>${escapeHtml(intro)}</p>`,
		...(payload.note?.trim()
			? [`<p>${escapeHtml(payload.note.trim()).replace(/\n/g, "<br>")}</p>`]
			: []),
		`<p><a href="${escapeHtml(payload.submissionUrl)}">Open contract submission</a></p>`,
		"<p>Best regards<br>TUM.ai</p>",
	].join("");

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ from, to: payload.to, subject, text, html }),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new Error(
			`Failed to send contract status email (${response.status}): ${
				detail || response.statusText
			}`,
		);
	}
}
