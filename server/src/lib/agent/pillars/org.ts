// The "org" pillar — TUM.ai's internal org structure (departments, batches/
// cohorts, and leadership roles). Tools:
//   list_departments     headcount per department (+ Board)
//   people_in_department  roster for one department
//   people_in_batch       roster for one cohort (WS##/SS##)
//   find_role_holders     who holds (or, with `year`, held) a role
// Roster/people tools harvest into ctx.collectedPeople so the final answer may
// cite them. Beacon visibility is active members only.

import { z } from "zod";
import {
	currentRoleHolders,
	historicalRoleHolders,
	listDepartments,
	normalizeRole,
	type OrgHit,
	peopleByBatch,
	peopleByDepartment,
} from "../../orgLookup.js";
import { type CollectedPerson, defineTool, type Pillar } from "../types.js";

function hitToPerson(h: OrgHit, score: number): CollectedPerson {
	return {
		user_id: h.user_id,
		name: h.name,
		avatar_url: null,
		best_chunk: h.detail,
		score,
		match_reason: h.detail,
	};
}

function renderHits(title: string, hits: OrgHit[]): string {
	if (!hits.length) return `${title}: none found.`;
	const lines = hits.map(
		(h) => `- @[${h.name}](beacon:${h.user_id}) — ${h.detail}`,
	);
	return `${title}:\n${lines.join("\n")}`;
}

const HISTORY_CAVEAT =
	"Note: role history records the role and dates only, not the department held at the time — the department shown is the member's *current* assignment, so narrow with care.";

export const orgPillar: Pillar = {
	id: "org",
	title: "Org structure",
	shortDescription:
		"TUM.ai's internal org — departments, batches/cohorts, and who currently holds or previously held leadership roles (Team Lead, Vice-President, President, Board Member). Active members only.",
	longDescription:
		"The TUM.ai org chart for active members. Use list_departments for a headcount overview, people_in_department / people_in_batch for a roster, and find_role_holders to answer 'who is/was the <role>'. Pass a `year` to find_role_holders for PAST role-holders (from role history). Role history records role + dates but not department, so a past-year lookup returns visible holders of that period with their current department.",
	promptGuidance:
		"The 'lead' / 'head' of a department IS its Team Lead: for 'who leads X' / 'who is the X department lead' / 'head of X', call find_role_holders with role='Team Lead' and department=X — do NOT use people_in_department (that's the whole roster, not the lead). Use find_role_holders for any 'who is/was the Team Lead / VP / President / Board' question; pass `year` for a past holder, otherwise it returns current holders. Use people_in_department / people_in_batch only when asked for a full roster/membership. Beacon never exposes inactive, alumni, or opted-out members. Don't claim someone held a department-specific role in a past year as certain — history doesn't store the department of the time.",
	tools: [
		defineTool({
			name: "list_departments",
			description:
				"Headcount per TUM.ai department (plus a Board count). Use for 'what departments are there' / 'how big is X'.",
			params: z.object({}),
			handler: async () => {
				const depts = await listDepartments();
				if (!depts.length) return { content: "No departments found." };
				const lines = depts.map(
					(d) =>
						`- ${d.department}: ${d.count} member${d.count === 1 ? "" : "s"}`,
				);
				return { content: `Departments (active):\n${lines.join("\n")}` };
			},
		}),
		defineTool({
			name: "people_in_department",
			description:
				"List members in a specific department (e.g. 'Software Development'). Accepts loose names like 'softdev'.",
			params: z.object({
				department: z.string().describe("Department name (fuzzy-matched)."),
			}),
			handler: async ({ department }) => {
				const hits = await peopleByDepartment(department);
				if (!hits.length)
					return {
						content: `No members found in a department matching '${department}'.`,
					};
				return {
					content: renderHits(`Members in '${department}'`, hits),
					people: hits.map((h) => hitToPerson(h, 1)),
				};
			},
		}),
		defineTool({
			name: "people_in_batch",
			description:
				"List members who joined in a specific batch/cohort, e.g. 'WS24' or 'SS25'.",
			params: z.object({
				batch: z.string().describe("Batch id like WS24 / SS25."),
			}),
			handler: async ({ batch }) => {
				const hits = await peopleByBatch(batch);
				if (!hits.length)
					return {
						content: `No members found for batch '${batch}' (expected a form like WS24 / SS25).`,
					};
				return {
					content: renderHits(`Members in batch '${batch}'`, hits),
					people: hits.map((h) => hitToPerson(h, 1)),
				};
			},
		}),
		defineTool({
			name: "find_role_holders",
			description:
				"Who holds a leadership role (Team Lead, Vice-President, President, Board Member). A department's 'lead' / 'head' is its Team Lead — for 'who leads <dept>' pass role='Team Lead' and department=<dept>. Pass `year` to find who HELD the role in that calendar year (from role history). Optional `department` narrows current lookups.",
			params: z.object({
				role: z
					.string()
					.describe("Team Lead, Vice-President, President, or Board Member."),
				year: z
					.number()
					.int()
					.min(2000)
					.max(2100)
					.optional()
					.describe(
						"OMIT this for who holds the role NOW. Only pass a PAST calendar year to look up who HELD it back then.",
					),
				department: z
					.string()
					.optional()
					.describe(
						"Narrow current holders to a department (ignored for past years).",
					),
			}),
			handler: async ({ role, year, department }) => {
				const canonical = normalizeRole(role);
				if (!canonical)
					return {
						content: `'${role}' isn't a role I track. Try Team Lead, Vice-President, President, or Board Member.`,
					};
				// Only a PAST year means a history lookup. The current year (or a
				// future one) means "who holds it now" — the model often passes the
				// current year for "currently", and history must not swallow that.
				if (year !== undefined && year < new Date().getFullYear()) {
					const hits = await historicalRoleHolders(canonical, year);
					if (!hits.length)
						return {
							content:
								canonical === "Board Member"
									? "Board membership isn't recorded in role history, so I can't look it up by year."
									: `No one is recorded as ${canonical} during ${year}.`,
						};
					return {
						content: `${renderHits(`${canonical} in ${year}`, hits)}\n\n${HISTORY_CAVEAT}`,
						people: hits.map((h) => hitToPerson(h, 0.9)),
					};
				}
				const hits = await currentRoleHolders(canonical, {
					department,
				});
				if (!hits.length)
					return {
						content: department
							? `No current ${canonical} found in a department matching '${department}'.`
							: `No current ${canonical} found.`,
					};
				return {
					content: renderHits(`Current ${canonical}`, hits),
					people: hits.map((h) => hitToPerson(h, 1)),
				};
			},
		}),
	],
};
