export const CONTRACT_DATA_TYPES = [
	"TEXT",
	"TEXTAREA",
	"NUMBER",
	"DATE",
	"BOOLEAN",
	"SELECT",
	"FILE",
	"EMAIL",
] as const;

export type ContractVariableDataType = (typeof CONTRACT_DATA_TYPES)[number];
export const CONTRACT_VARIABLE_DATA_TYPES = CONTRACT_DATA_TYPES;

export const CONTRACT_CONDITION_TYPES = [
	"ALWAYS",
	"IF_YES",
	"IF_NO",
	"IF_VALUE",
] as const;

export type ContractConditionType = (typeof CONTRACT_CONDITION_TYPES)[number];

export const CONTRACT_WORKFLOW_STATUSES = [
	"draft",
	"submitted",
	"legal_review",
	"in_review",
	"approved",
	"sent_to_partner",
	"partner_comments",
	"partner_signed",
	"board_signed",
	"rejected",
	"inquiry",
	"signed",
	"completed",
] as const;

export type ContractWorkflowStatus =
	(typeof CONTRACT_WORKFLOW_STATUSES)[number];

export const CONTRACT_REVIEW_STATUSES = [
	"draft",
	"submitted",
	"legal_review",
	"in_review",
	"approved",
	"rejected",
	"inquiry",
	"signed",
	"completed",
] as const satisfies readonly ContractWorkflowStatus[];

export type ContractReviewStatus = (typeof CONTRACT_REVIEW_STATUSES)[number];

export interface ContractTemplate {
	id: string;
	name: string;
	description: string | null;
	contract_text: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ContractTemplateVariable {
	id: string;
	template_id: string;
	variable_name: string;
	label: string;
	data_type: ContractVariableDataType;
	help_text: string | null;
	options: string[] | null;
	is_required: boolean;
	is_multiselect: boolean;
	show_if_variable: string | null;
	show_if_value: string | null;
	sort_order: number;
}

export interface ContractConditionalBlock {
	id: string;
	template_id: string;
	name: string;
	condition_type: ContractConditionType;
	condition_variable: string | null;
	condition_value: string | null;
	block_text: string;
	sort_order: number;
}

export type ContractRenderableBlock = Pick<
	ContractConditionalBlock,
	| "condition_type"
	| "condition_variable"
	| "condition_value"
	| "block_text"
	| "sort_order"
>;

export interface ContractTemplateDetail {
	template: ContractTemplate;
	variables: ContractTemplateVariable[];
	blocks: ContractConditionalBlock[];
}

export interface RenderedContractDocument {
	text: string;
	html: string;
	pages: string[];
}

export interface ContractSubmission {
	id: string;
	template_id: string;
	submitter_user_id: string;
	form_data: Record<string, unknown>;
	generated_contract_text: string | null;
	admin_edited_text: string | null;
	status: ContractWorkflowStatus;
	notes: string | null;
	feedback_message: string | null;
	rejection_reason: string | null;
	signature_token: string | null;
	signature_token_expires_at: string | null;
	signature_data: string | null;
	signer_name: string | null;
	signed_at: string | null;
	admin_signature_data: string | null;
	admin_signer_name: string | null;
	admin_signed_at: string | null;
	board_signature_token: string | null;
	board_signature_token_expires_at: string | null;
	partner_comment: string | null;
	partner_commented_at: string | null;
	sent_to_partner_at: string | null;
	partner_email_sent_at: string | null;
	partner_email_recipient: string | null;
	partner_email_error: string | null;
	clarification_email_sent_at: string | null;
	clarification_email_recipient: string | null;
	clarification_email_error: string | null;
	signature_provider: "in_app" | "opensign";
	opensign_document_id: string | null;
	opensign_status: string | null;
	opensign_sent_at: string | null;
	opensign_completed_at: string | null;
	opensign_file_url: string | null;
	opensign_certificate_url: string | null;
	opensign_error: string | null;
	auto_send_after_board_signed: boolean;
	final_pdf_token: string | null;
	final_pdf_sent_at: string | null;
	completed_at: string | null;
	active_document_version_id: string | null;
	sent_document_version_id: string | null;
	final_document_version_id: string | null;
	submitted_at: string;
	created_at: string;
	updated_at: string;
}

export interface ContractPartnerComment {
	id: string;
	submission_id: string;
	author_type: "partner" | "internal";
	author_name: string | null;
	author_email: string | null;
	comment: string;
	document_version_id: string | null;
	created_at: string;
}

export interface PublicContractPartnerComment {
	author_type: "partner" | "internal";
	author_name: string | null;
	comment: string;
	created_at: string;
}

export interface PublicSignPayload {
	contract_text: string;
	html: string;
	pages: string[];
	status: ContractWorkflowStatus;
	comments: PublicContractPartnerComment[];
}

export interface PublicBoardSignPayload {
	contract_text: string;
	html: string;
	pages: string[];
	status: ContractWorkflowStatus;
	partner_signer_name: string | null;
	partner_signature_data: string | null;
	partner_signed_at: string | null;
}

/**
 * A single status transition recorded for a contract submission. Appended
 * (never overwritten) so the full history stays visible in the contract view.
 */
export interface ContractStatusEvent {
	id: string;
	submission_id: string;
	from_status: ContractWorkflowStatus | null;
	to_status: ContractWorkflowStatus;
	changed_by: string | null;
	changed_by_name: string | null;
	note: string | null;
	created_at: string;
}

export interface ContractPackageDefinition {
	label: string;
	amountEur: number;
	amountLabel: string;
	amountWords: string;
	benefits: string[];
	footnote?: string;
}

export interface ContractAddonDefinition {
	label: string;
	amountEur: number | null;
	amountLabel: string;
	appliesToPackages: string[];
}

export const CONTRACT_PACKAGES: Record<string, ContractPackageDefinition> = {
	long_term_bronze: {
		label: "Long-Term Partnership - Bronze",
		amountEur: 6000,
		amountLabel: "6.000 EUR / Jahr",
		amountWords: "sechstausend",
		benefits: [
			"Partner logo on website",
			"2x LinkedIn post per year",
			"1x Networking event invitation",
		],
	},
	long_term_silver: {
		label: "Long-Term Partnership - Silver",
		amountEur: 12000,
		amountLabel: "12.000 EUR / Jahr",
		amountWords: "zwoelftausend",
		benefits: [
			"Partner logo on website",
			"2x LinkedIn post per year",
			"1x Networking event invitation",
			"Access to CV database (CVs der zwei letzten Batches, ca. 100-150 CVs)",
			"1x Co-organized event",
			"2x Job postings to community",
		],
	},
	long_term_gold: {
		label: "Long-Term Partnership - Gold",
		amountEur: 15000,
		amountLabel: "15.000 EUR / Jahr",
		amountWords: "fuenfzehntausend",
		benefits: [
			"Distinguished logo placement",
			"2x LinkedIn post per year",
			"1x Networking event invitation",
			"Access to CV database (CVs der zwei letzten Batches, ca. 100-150 CVs)",
			"2x Co-organized events",
			"Unlimited Job postings",
			"First-choice for Hackathons",
		],
	},
	long_term_principal: {
		label: "Long-Term Partnership - Principal",
		amountEur: 35000,
		amountLabel: "35.000 EUR / Jahr",
		amountWords: "fuenfunddreissigtausend",
		benefits: [
			"Distinguished logo placement",
			"2x LinkedIn post per year",
			"1x Networking event invitation",
			"Access to CV database (CVs der zwei letzten Batches, ca. 100-150 CVs)",
			"2x Co-organized events",
			"Unlimited Job postings",
			"First-choice for Hackathons",
			"Founding Partner status",
			"First access to every new cohort",
			"1x Keynote at annual summit",
			"Branded Fellowship",
			"2x Custom events",
		],
	},
	ehl_bronze: {
		label: "EHL Hackathon Pass - Bronze",
		amountEur: 4500,
		amountLabel: "4.500 EUR",
		amountWords: "viertausendfuenfhundert",
		benefits: [
			"1x Booth at the venue",
			"1x Networking event invitation",
			"2x Announced on LinkedIn",
		],
	},
	ehl_silver: {
		label: "EHL Hackathon Pass - Silver",
		amountEur: 7500,
		amountLabel: "7.500 EUR",
		amountWords: "siebentausendfuenfhundert",
		benefits: [
			"1x Custom Challenge path",
			"2x Announced on LinkedIn",
			"1x Participant list (incl. CVs)",
		],
	},
	ehl_gold: {
		label: "EHL Hackathon Pass - Gold",
		amountEur: 9000,
		amountLabel: "9.000 EUR",
		amountWords: "neuntausend",
		benefits: [
			"1x Custom Challenge path",
			"2x Announced on LinkedIn",
			"1x Participant list (incl. CVs)",
			"1x Exclusive LinkedIn post",
			"1x Community Event",
			"2x Job posting to community",
		],
	},
	ehl_platinum: {
		label: "EHL Hackathon Pass - Platinum",
		amountEur: 12000,
		amountLabel: "12.000 EUR",
		amountWords: "zwoelftausend",
		benefits: [
			"1x Custom Challenge path",
			"2x Announced on LinkedIn",
			"1x Participant list (incl. CVs)",
			"1x Exclusive LinkedIn post",
			"1x Community Event",
			"2x Job posting to community",
			"1x Keynote slot during the event",
			"1x Logo on EHL website",
		],
	},
	e_lab_midterm: {
		label: "E-Lab Jury Seat Midterm",
		amountEur: 1800,
		amountLabel: "1.800 EUR",
		amountWords: "eintausendachthundert",
		benefits: ["1x Jury Seat beim Midterm Pitch"],
	},
	e_lab_final: {
		label: "E-Lab Jury Seat Final Pitch",
		amountEur: 3500,
		amountLabel: "3.500 EUR",
		amountWords: "dreitausendfuenfhundert",
		benefits: ["1x Jury Seat beim Final Pitch"],
	},
};

export const CONTRACT_ADDONS: Record<string, ContractAddonDefinition> = {
	long_term_extra_linkedin_post: {
		label: "Extra LinkedIn Post",
		amountEur: 750,
		amountLabel: "750 EUR",
		appliesToPackages: [
			"long_term_bronze",
			"long_term_silver",
			"long_term_gold",
			"long_term_principal",
		],
	},
	long_term_custom_mail: {
		label: "Custom Mail to Community",
		amountEur: 1400,
		amountLabel: "1.400 EUR",
		appliesToPackages: [
			"long_term_bronze",
			"long_term_silver",
			"long_term_gold",
			"long_term_principal",
		],
	},
	long_term_workshop_slot: {
		label: "Workshop Slot",
		amountEur: 2300,
		amountLabel: "2.300 EUR",
		appliesToPackages: [
			"long_term_bronze",
			"long_term_silver",
			"long_term_gold",
			"long_term_principal",
		],
	},
	long_term_hackathon_challenge: {
		label: "Hackathon Challenge",
		amountEur: null,
		amountLabel: "5.000-25.000 EUR",
		appliesToPackages: [
			"long_term_bronze",
			"long_term_silver",
			"long_term_gold",
			"long_term_principal",
		],
	},
	ehl_catering_sponsorship: {
		label: "Catering Sponsorship",
		amountEur: null,
		amountLabel: "Price on request",
		appliesToPackages: ["ehl_bronze", "ehl_silver", "ehl_gold", "ehl_platinum"],
	},
	ehl_ceremony_job_posting: {
		label: "Job Posting in Ceremony",
		amountEur: 700,
		amountLabel: "700 EUR",
		appliesToPackages: ["ehl_bronze", "ehl_silver", "ehl_gold", "ehl_platinum"],
	},
	ehl_workshop_slot: {
		label: "Workshop Slot",
		amountEur: 1000,
		amountLabel: "1.000 EUR",
		appliesToPackages: ["ehl_bronze", "ehl_silver", "ehl_gold", "ehl_platinum"],
	},
};

function formatEurAmount(amount: number): string {
	return `${new Intl.NumberFormat("de-DE").format(amount)} EUR`;
}

function selectedAddonKeys(formData: Record<string, unknown>): string[] {
	const raw = formData.selected_addons;
	if (Array.isArray(raw)) return raw.map(String);
	if (typeof raw === "string" && raw.trim()) return [raw.trim()];
	return [];
}

export function enrichContractFormData(
	formData: Record<string, unknown>,
): Record<string, unknown> {
	const packageKey =
		typeof formData.sponsoring_package === "string"
			? formData.sponsoring_package
			: null;
	const packageDef = packageKey ? CONTRACT_PACKAGES[packageKey] : undefined;
	const addons = selectedAddonKeys(formData)
		.map((key) => CONTRACT_ADDONS[key])
		.filter((addon) => {
			if (!addon) return false;
			return packageKey ? addon.appliesToPackages.includes(packageKey) : true;
		});
	const fixedAddonTotal = addons.reduce(
		(sum, addon) => sum + (addon.amountEur ?? 0),
		0,
	);
	const hasVariablePricedAddons = addons.some(
		(addon) => addon.amountEur === null,
	);
	const manualAddonTerms =
		typeof formData.addon_terms === "string" && formData.addon_terms.trim()
			? formData.addon_terms
			: null;

	const addonTerms =
		addons.length > 0
			? addons
					.map((addon) => `- ${addon.label}: ${addon.amountLabel}`)
					.join("\n")
			: (manualAddonTerms ?? "Keine Add-ons ausgewaehlt.");

	return {
		...formData,
		...(packageDef
			? {
					package_label: packageDef.label,
					package_amount_eur: packageDef.amountEur,
					package_amount_label: packageDef.amountLabel,
					package_amount_words: packageDef.amountWords,
					package_benefits: packageDef.benefits
						.map((benefit) => `- ${benefit}`)
						.join("\n"),
					package_footnote:
						packageDef.footnote ??
						"Subject to topic being related to Club and approved by both parties. Pricing may vary depending on individual scope and agreement.",
				}
			: {}),
		addon_terms: addonTerms,
		addon_total_amount_eur: fixedAddonTotal,
		addon_total_amount_label:
			fixedAddonTotal > 0 ? formatEurAmount(fixedAddonTotal) : "0 EUR",
		total_amount_eur: packageDef
			? packageDef.amountEur + fixedAddonTotal
			: null,
		total_amount_label: packageDef
			? `${formatEurAmount(packageDef.amountEur + fixedAddonTotal)}${
					hasVariablePricedAddons ? " plus variable add-ons" : ""
				}`
			: null,
	};
}
