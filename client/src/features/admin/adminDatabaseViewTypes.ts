import type { AdminFilters, AdminSortKey } from "./adminUtils";

// Radix Select forbids an empty-string item value, so the editor's "clear"
// options carry a sentinel that maps back to "" in the change handlers.
export const NONE_VALUE = "__none__";
// The filter dropdowns expose an "All" option that the underlying filter state
// represents as "". Same sentinel-mapping trick as above.
export const ALL_VALUE = "__all__";

export const initialFilters: AdminFilters = {
	search: "",
	mandateAgreed: "",
	privacyAgreed: "",
	dataPrivacyNoticeAgreed: "",
	active: "",
};

export const sortableColumns: Array<{
	key: AdminSortKey;
	label: string;
	width?: number;
}> = [
	{ key: "surname", label: "Member", width: 260 },
	{ key: "department", label: "Department", width: 160 },
	{ key: "member_role", label: "Role", width: 160 },
	{ key: "board_role", label: "Board", width: 140 },
	{ key: "phone", label: "Phone", width: 150 },
	{ key: "linkedin_profile_url", label: "LinkedIn", width: 120 },
	{ key: "public_location", label: "Public location", width: 170 },
	{ key: "iban", label: "IBAN", width: 220 },
	{ key: "bic", label: "BIC", width: 150 },
	{ key: "bank_name", label: "Bank", width: 180 },
	{ key: "mandate_agreed", label: "SEPA", width: 140 },
	{ key: "privacy_agreed", label: "Privacy", width: 140 },
	{ key: "data_privacy_notice_agreed", label: "Data Privacy", width: 170 },
	{ key: "active", label: "Status", width: 140 },
];
