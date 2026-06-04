interface ContractPartnerEmailPayload {
	to: string;
	partnerCompanyName: string;
	signingUrl: string;
	customMessage?: string | null;
	subject?: string | null;
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
