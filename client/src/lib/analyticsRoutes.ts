// Longer, more specific prefixes are listed before their broader parents so
// the first match wins (e.g. reimbursement review before reimbursement,
// members/org-tree before members).
const FEATURE_ROUTES: ReadonlyArray<{ prefix: string; feature: string }> = [
	{ prefix: "/tools/reimbursement/review", feature: "reimbursements-review" },
	{ prefix: "/tools/reimbursement", feature: "reimbursements" },
	{ prefix: "/tools/finance", feature: "finance" },
	{ prefix: "/tools/tumai-days", feature: "tumai-days" },
	{ prefix: "/tools/engagement-certificate", feature: "certificate" },
	{ prefix: "/tools/jobs", feature: "jobs" },
	{ prefix: "/tools/partners", feature: "partner-management" },
	{ prefix: "/engagement-certificate", feature: "certificate" },
	{ prefix: "/education/courses", feature: "education-courses" },
	{ prefix: "/members/org-chart", feature: "members-org-chart" },
	{ prefix: "/members/org-tree", feature: "members-org-tree" },
	{ prefix: "/members/research", feature: "members-research" },
	{ prefix: "/members/innovation", feature: "members-innovation" },
	{ prefix: "/members", feature: "members" },
	{ prefix: "/contracts/sign", feature: "contracts-partner-sign" },
	{ prefix: "/contracts/board-sign", feature: "contracts-board-sign" },
	{ prefix: "/contracts/templates", feature: "contracts-templates" },
	{ prefix: "/contracts/submissions", feature: "contracts-submissions" },
	{ prefix: "/contracts", feature: "contracts" },
	{ prefix: "/admin", feature: "admin" },
	{ prefix: "/profile", feature: "profile" },
];

/**
 * Maps a route pathname to a coarse feature name for adoption analytics, so
 * usage can be sliced per feature instead of per raw (and more numerous)
 * route. Unmatched paths - including "/" - fall back to "profile", this
 * app's landing page.
 */
export function getFeatureNameForPath(pathname: string): string {
	const match = FEATURE_ROUTES.find(
		({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
	return match?.feature ?? "profile";
}
