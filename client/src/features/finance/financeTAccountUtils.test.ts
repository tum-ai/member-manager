import { describe, expect, it } from "vitest";
import {
	tAccountAllocation as allocation,
	tAccountGroup as group,
	tAccountLine as line,
	tAccountMatch as match,
	tAccountPlanDetail as planDetail,
	tAccountPostingDetail as postingDetail,
} from "@/features/finance/financeTAccountFixtures";
import {
	buildTAccountTree,
	collectMatchCandidates,
	openPostingAmount,
	summarizeAllocationResults,
	vatLabel,
} from "./financeTAccountUtils";

const MAKEATHON = "11111111-1111-4111-8111-111111111111";
const HACKATHON = "22222222-2222-4222-8222-222222222222";

describe("collectMatchCandidates", () => {
	function tree() {
		return buildTAccountTree([
			group({
				expense_lines: [
					// Fully open invoice.
					line({
						kind: "actual",
						amount: 500,
						label: "Catering",
						posting_external_id: "BB-1",
					}),
					// Partly matched: only the rest is still on offer.
					line({
						kind: "actual",
						amount: 400,
						label: "Venue",
						posting_external_id: "BB-2",
						posting_detail: postingDetail({
							matches: [
								match({
									id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
									posting_external_id: "BB-2",
									plan_item_id: "plan-venue",
									matched_amount: 300,
								}),
							],
						}),
					}),
					line({
						kind: "plan",
						amount: 800,
						label: "Recruiting",
						plan_item_id: "plan-recruiting",
					}),
					// Parked: refuses matches server-side (FR-M8), so never offered.
					line({
						kind: "plan",
						amount: 500,
						label: "Gestrichen",
						plan_item_id: "plan-cancelled",
						plan_detail: planDetail({ planned_amount: 500, is_active: false }),
					}),
				],
				income_lines: [
					line({
						kind: "plan",
						direction: "income",
						amount: 1000,
						label: "Sponsoring (offen)",
						plan_item_id: "plan-sponsoring",
					}),
				],
			}),
		]);
	}

	it("offers open invoices and active Planposten with their open amounts", () => {
		const { planItems, postings } = collectMatchCandidates(tree());

		expect(postings.map((entry) => [entry.label, entry.openAmount])).toEqual([
			["Catering", 500],
			// 400 booked − 300 already matched.
			["Venue", 100],
		]);
		expect(planItems.map((entry) => [entry.label, entry.direction])).toEqual([
			["Recruiting", "expense"],
			["Sponsoring (offen)", "income"],
		]);
		// The parked Planposten is not on offer.
		expect(planItems.some((entry) => entry.label === "Gestrichen")).toBe(false);
	});

	it("carries the scope a match has to share (FR-M5)", () => {
		// A Planposten can only absorb the share of a posting allocated to its own
		// project, so both sides carry the project they belong to and the caller
		// pairs like with like.
		const candidates = collectMatchCandidates(
			buildTAccountTree([
				group({
					expense_lines: [
						line({
							kind: "actual",
							amount: 100,
							label: "Department-Rechnung",
							posting_external_id: "BB-dept",
						}),
					],
				}),
				group({
					project_id: MAKEATHON,
					project_name: "Makeathon",
					expense_lines: [
						line({
							kind: "plan",
							amount: 900,
							label: "Projekt-Plan",
							plan_item_id: "plan-project",
							project_id: MAKEATHON,
						}),
					],
				}),
			]),
		);

		expect(candidates.postings[0]?.projectId).toBeNull();
		expect(candidates.planItems[0]?.projectId).toBe(MAKEATHON);
	});

	it("computes what is left of a partly matched invoice", () => {
		const [node] = tree();
		const venue = node.expenseLines.find((l) => l.label === "Venue");
		const catering = node.expenseLines.find((l) => l.label === "Catering");

		expect(venue && openPostingAmount(venue)).toBe(100);
		expect(catering && openPostingAmount(catering)).toBe(500);
	});
});

describe("summarizeAllocationResults", () => {
	it("reports a clean run without a skip clause", () => {
		const summary = summarizeAllocationResults([
			{ posting_external_id: "BB-1", applied: true, reason: null },
			{ posting_external_id: "BB-2", applied: true, reason: null },
		]);

		expect(summary.hasSkips).toBe(false);
		expect(summary.message).toBe("2 Buchungen zugeordnet.");
	});

	it("names every skip, grouped by reason (FR-L6)", () => {
		const summary = summarizeAllocationResults([
			{ posting_external_id: "BB-1", applied: true, reason: null },
			{ posting_external_id: "BB-2", applied: false, reason: "already_split" },
			{ posting_external_id: "BB-3", applied: false, reason: "already_split" },
			{
				posting_external_id: "BB-4",
				applied: false,
				reason: "period_mismatch",
			},
		]);

		expect(summary.hasSkips).toBe(true);
		expect(summary.message).toBe(
			"1 von 4 Buchungen zugeordnet. 3 übersprungen: 2× bereits aufgeteilt, 1× außerhalb des Projektzeitraums.",
		);
	});

	it("uses the singular for a single booking", () => {
		const summary = summarizeAllocationResults([
			{ posting_external_id: "BB-1", applied: true, reason: null },
		]);

		expect(summary.message).toBe("1 Buchung zugeordnet.");
	});
});

describe("vatLabel", () => {
	it("names the side of the ledger instead of a generic USt (FR-N2)", () => {
		expect(vatLabel("expense")).toBe("Vorsteuer");
		expect(vatLabel("income")).toBe("Umsatzsteuer");
	});
});

describe("buildTAccountTree", () => {
	it("derives per-column Ist and planned-only Plan subtotals", () => {
		const [node] = buildTAccountTree([
			group({
				expense_lines: [
					line({ kind: "actual", amount: 1200, label: "Team-Offsite" }),
					line({ kind: "actual", amount: 340, label: "Tooling" }),
					line({ kind: "plan", amount: 800, label: "Recruiting" }),
				],
				income_lines: [
					line({ kind: "actual", direction: "income", amount: 3000 }),
				],
			}),
		]);

		expect(node.expenseSummary).toEqual({
			ist: 1540,
			plan: 800,
			vatIst: 0,
			vatPlan: 0,
		});
		expect(node.incomeSummary).toEqual({
			ist: 3000,
			plan: 0,
			vatIst: 0,
			vatPlan: 0,
		});
		// Ist-Saldo = booked income − booked expenses; Forecast folds in planned.
		expect(node.actualSaldo).toBe(1460);
		expect(node.planSaldo).toBe(660);
	});

	it("nests a child project and rolls its net into the parent", () => {
		const tree = buildTAccountTree([
			group({
				project_id: MAKEATHON,
				project_name: "Makeathon",
				target_amount: 50_000,
				expense_lines: [
					line({ kind: "actual", amount: 1200, label: "Team-Offsite" }),
					line({ kind: "actual", amount: 340, label: "Tooling" }),
					line({ kind: "plan", amount: 800, label: "Recruiting" }),
				],
				income_lines: [
					line({ kind: "actual", direction: "income", amount: 3000 }),
				],
			}),
			group({
				project_id: HACKATHON,
				project_name: "Hackathon",
				parent_project_id: MAKEATHON,
				expense_lines: [
					line({ kind: "actual", amount: 2000, label: "Preise" }),
				],
				income_lines: [
					line({ kind: "actual", direction: "income", amount: 17_420 }),
					line({ kind: "plan", direction: "income", amount: 1100 }),
				],
			}),
		]);

		// One top-level node (Makeathon); Hackathon nested inside it.
		expect(tree).toHaveLength(1);
		const makeathon = tree[0];
		expect(makeathon.children).toHaveLength(1);
		expect(makeathon.children[0].projectName).toBe("Hackathon");

		// Child's booked net (15.420) and still-open net (1.100) roll up as folder
		// lines in the parent's income column.
		const rolled = makeathon.incomeLines.filter((l) => l.isProjectRollup);
		expect(rolled.map((l) => [l.kind, l.amount])).toEqual([
			["actual", 15_420],
			["plan", 1100],
		]);
		// Parent income Ist = own 3.000 + rolled 15.420; planned-only = 1.100.
		expect(makeathon.incomeSummary).toEqual({
			ist: 18_420,
			plan: 1100,
			vatIst: 0,
			vatPlan: 0,
		});
		// A folder line nets many rates into one figure, so it carries no VAT and
		// stays out of the parent's VAT subtotal — and it does not expand.
		expect(rolled.every((l) => l.vatAmount === null)).toBe(true);
		expect(rolled.every((l) => l.postingDetail === null)).toBe(true);
		expect(makeathon.actualSaldo).toBe(16_880);
		// Forecast = child forecast + parent planned rows netted in.
		expect(makeathon.planSaldo).toBe(17_180);
	});

	it("computes deviation against the target and treats 0 as unset", () => {
		const [withTarget] = buildTAccountTree([
			group({
				project_id: MAKEATHON,
				project_name: "Makeathon",
				target_amount: 50_000,
				income_lines: [
					line({ kind: "actual", direction: "income", amount: 16_880 }),
				],
			}),
		]);
		expect(withTarget.targetAmount).toBe(50_000);
		expect(withTarget.deviation).toBe(-33_120);

		const [zeroTarget] = buildTAccountTree([
			group({ project_id: HACKATHON, project_name: "H", target_amount: 0 }),
		]);
		expect(zeroTarget.targetAmount).toBeNull();
		expect(zeroTarget.deviation).toBeNull();
	});

	it("nests a project inside the sub-team folder that owns it (FR-L4)", () => {
		const tree = buildTAccountTree([
			group({
				project_name: "Big Makeathon",
				sub_team: "Big Makeathon",
				is_sub_team: true,
				expense_lines: [line({ kind: "actual", amount: 500, label: "Bus" })],
			}),
			group({
				project_id: MAKEATHON,
				project_name: "Sponsoring-Kampagne",
				sub_team: "Big Makeathon",
				expense_lines: [line({ kind: "actual", amount: 200, label: "Druck" })],
			}),
		]);

		// One root — the sub-team folder — with the project inside it.
		expect(tree).toHaveLength(1);
		const subTeam = tree[0];
		expect(subTeam.isSubTeam).toBe(true);
		expect(subTeam.children.map((child) => child.projectName)).toEqual([
			"Sponsoring-Kampagne",
		]);
		// The project's net rolls up into its sub-team folder like any child.
		expect(subTeam.expenseLines.some((l) => l.isProjectRollup)).toBe(true);
		expect(subTeam.actualSaldo).toBe(-700);
	});

	it("keeps a sub-project under its parent, not under the sub-team", () => {
		const tree = buildTAccountTree([
			group({
				project_name: "Big Makeathon",
				sub_team: "Big Makeathon",
				is_sub_team: true,
			}),
			group({
				project_id: MAKEATHON,
				project_name: "Makeathon",
				sub_team: "Big Makeathon",
			}),
			group({
				project_id: HACKATHON,
				project_name: "Hackathon",
				parent_project_id: MAKEATHON,
				sub_team: "Big Makeathon",
			}),
		]);

		expect(tree).toHaveLength(1);
		const makeathon = tree[0].children[0];
		expect(makeathon.projectName).toBe("Makeathon");
		expect(makeathon.children.map((child) => child.projectName)).toEqual([
			"Hackathon",
		]);
	});

	it("keeps a project top-level when its sub-team folder is absent", () => {
		const tree = buildTAccountTree([
			group({
				project_id: MAKEATHON,
				project_name: "Sponsoring-Kampagne",
				sub_team: "Ghost-Team",
			}),
		]);

		expect(tree).toHaveLength(1);
		expect(tree[0].projectName).toBe("Sponsoring-Kampagne");
		expect(tree[0].subTeam).toBe("Ghost-Team");
	});

	it("keeps sub-team groups as distinct top-level nodes", () => {
		const tree = buildTAccountTree([
			group({
				project_name: "Big Makeathon",
				expense_lines: [line({ kind: "actual", amount: 500 })],
			}),
			group({
				expense_lines: [line({ kind: "actual", amount: 120 })],
			}),
		]);

		// Both have project_id null but stay separate: the named one is a sub-team
		// folder, the unnamed one the "Direkt zugeordnet" bucket.
		expect(tree).toHaveLength(2);
		const subTeam = tree.find((n) => n.projectName === "Big Makeathon");
		const ungrouped = tree.find((n) => n.projectName === null);
		expect(subTeam?.projectId).toBeNull();
		expect(subTeam?.actualSaldo).toBe(-500);
		expect(ungrouped?.actualSaldo).toBe(-120);
	});

	it("sums VAT per column, booked and planned separately (FR-N3)", () => {
		const [node] = buildTAccountTree([
			group({
				expense_lines: [
					// Vorsteuer on the expense side — invisible before FR-N1.
					line({ kind: "actual", amount: 119, vat_amount: 19, vat_rate: 19 }),
					line({ kind: "actual", amount: 214, vat_amount: 14, vat_rate: 7 }),
					line({
						kind: "plan",
						amount: 1190,
						vat_amount: 190,
						vat_rate: 19,
						plan_item_id: "plan-venue",
					}),
				],
				income_lines: [
					line({
						kind: "actual",
						direction: "income",
						amount: 11_900,
						vat_amount: 1900,
						vat_rate: 19,
					}),
				],
			}),
		]);

		expect(node.expenseSummary).toEqual({
			ist: 333,
			plan: 1190,
			vatIst: 33,
			vatPlan: 190,
		});
		expect(node.incomeSummary).toEqual({
			ist: 11_900,
			plan: 0,
			vatIst: 1900,
			vatPlan: 0,
		});
	});

	it("keeps a disabled Planposten visible but out of every plan subtotal", () => {
		const [node] = buildTAccountTree([
			group({
				expense_lines: [
					line({ kind: "actual", amount: 100, label: "Catering" }),
					line({
						kind: "plan",
						amount: 800,
						label: "Recruiting",
						plan_item_id: "plan-recruiting",
						vat_amount: 128,
						vat_rate: 19,
					}),
					line({
						kind: "plan",
						amount: 500,
						label: "Gestrichen",
						plan_item_id: "plan-cancelled",
						vat_amount: 80,
						vat_rate: 19,
						plan_detail: planDetail({ planned_amount: 500, is_active: false }),
					}),
				],
			}),
		]);

		// The disabled line still renders (it must be re-enablable from the T-view)…
		expect(node.expenseLines.map((l) => l.label)).toContain("Gestrichen");
		expect(
			node.expenseLines.find((l) => l.label === "Gestrichen")?.isActive,
		).toBe(false);
		// …but neither its amount nor its VAT moves a subtotal or the forecast.
		expect(node.expenseSummary).toEqual({
			ist: 100,
			plan: 800,
			vatIst: 0,
			vatPlan: 128,
		});
		expect(node.planSaldo).toBe(-900);
	});

	it("names a Planposten that has no line of its own", () => {
		// Fully matched, so the server emits no plan line for it — the invoice that
		// funds it must still show its name rather than a bare "Planposten".
		const [node] = buildTAccountTree(
			[
				group({
					expense_lines: [
						line({
							kind: "actual",
							label: "Venue-Anzahlung",
							amount: 100,
							posting_external_id: "BB-settled",
							posting_detail: postingDetail({
								matches: [
									match({
										plan_item_id: "plan-venue",
										posting_external_id: "BB-settled",
										matched_amount: 100,
									}),
								],
							}),
						}),
					],
				}),
			],
			{ "plan-venue": "Venue" },
		);

		expect(node.expenseLines[0]?.matches.map((m) => m.label)).toEqual([
			"Venue",
		]);
	});

	it("resolves allocation projects and match counterparts to names (FR-K2)", () => {
		const [node] = buildTAccountTree([
			group({
				project_id: HACKATHON,
				project_name: "Hackathon",
				expense_lines: [
					line({
						kind: "actual",
						label: "Preise",
						amount: 2000,
						posting_external_id: "BB-5",
						posting_detail: postingDetail({
							allocations: [
								allocation({
									posting_external_id: "BB-5",
									project_id: HACKATHON,
									department: "Makeathon",
									allocated_amount: 2000,
								}),
							],
							matches: [
								match({
									plan_item_id: "plan-prizes",
									posting_external_id: "BB-5",
									matched_amount: 2000,
								}),
							],
						}),
					}),
					line({
						kind: "plan",
						label: "Preisgeld (geplant)",
						amount: 500,
						plan_item_id: "plan-prizes",
						plan_detail: planDetail({
							planned_amount: 2500,
							matched_amount: 2000,
							delta: -500,
							matches: [
								match({
									plan_item_id: "plan-prizes",
									posting_external_id: "BB-5",
									matched_amount: 2000,
								}),
							],
						}),
					}),
				],
			}),
		]);

		const posting = node.expenseLines[0];
		expect(posting.allocations).toEqual([
			expect.objectContaining({
				department: "Makeathon",
				projectName: "Hackathon",
			}),
		]);
		// A posting row names the Planposten it feeds…
		expect(posting.matches.map((m) => m.label)).toEqual([
			"Preisgeld (geplant)",
		]);
		// …and the Planposten names the invoice that arrived against it.
		const plan = node.expenseLines[1];
		expect(plan.matches).toEqual([
			expect.objectContaining({ label: "Preise", amount: 2000 }),
		]);
	});

	it("keeps a child top-level when its parent is absent for the department", () => {
		const tree = buildTAccountTree([
			group({
				project_id: HACKATHON,
				project_name: "Hackathon",
				parent_project_id: MAKEATHON,
			}),
		]);
		expect(tree).toHaveLength(1);
		expect(tree[0].projectName).toBe("Hackathon");
		expect(tree[0].children).toHaveLength(0);
	});
});
