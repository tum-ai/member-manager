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
	collectSubTeamOptions,
	openPostingAmount,
	summarizeAllocationResults,
	vatLabel,
} from "./financeTAccountUtils";

const MAKEATHON = "11111111-1111-4111-8111-111111111111";
const HACKATHON = "22222222-2222-4222-8222-222222222222";

describe("buildTAccountTree amount mode", () => {
	// 119 gross / 100 net on the expense side, 11.900 / 10.000 on the income
	// side — the classic 19 % pair, so every figure below is checkable by hand.
	function groups() {
		return [
			group({
				expense_lines: [
					line({
						kind: "actual",
						amount: 119,
						vat_amount: 19,
						vat_rate: 19,
						net_amount: 100,
						label: "Catering",
					}),
					line({
						kind: "plan",
						amount: 1190,
						vat_amount: 190,
						vat_rate: 19,
						net_amount: 1000,
						label: "Venue",
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
						net_amount: 10_000,
						label: "Sponsoring",
					}),
				],
			}),
		];
	}

	it("shows gross amounts and gross saldi by default", () => {
		const [node] = buildTAccountTree(groups());

		expect(node.expenseLines[0]?.amount).toBe(119);
		expect(node.incomeLines[0]?.amount).toBe(11_900);
		expect(node.expenseSummary.ist).toBe(119);
		expect(node.incomeSummary.ist).toBe(11_900);
		expect(node.actualSaldo).toBe(11_781);
		// Forecast = booked 11.781 − the still-open 1.190.
		expect(node.planSaldo).toBe(10_591);
	});

	it("switches every amount, subtotal and balance to net", () => {
		const [node] = buildTAccountTree(groups(), { amountMode: "net" });

		// Both directions, booked and planned.
		expect(node.expenseLines[0]?.amount).toBe(100);
		expect(node.expenseLines[1]?.amount).toBe(1000);
		expect(node.incomeLines[0]?.amount).toBe(10_000);
		expect(node.expenseSummary).toEqual({
			ist: 100,
			plan: 1000,
			// VAT is VAT in either mode — only the amounts it sits on change.
			vatIst: 19,
			vatPlan: 190,
		});
		expect(node.incomeSummary.ist).toBe(10_000);
		expect(node.actualSaldo).toBe(9_900);
		expect(node.planSaldo).toBe(8_900);
	});

	it("keeps both figures on the line, whichever mode is active", () => {
		const [gross] = buildTAccountTree(groups());
		const [net] = buildTAccountTree(groups(), { amountMode: "net" });

		for (const node of [gross, net]) {
			expect(node.expenseLines[0]?.grossAmount).toBe(119);
			expect(node.expenseLines[0]?.netAmount).toBe(100);
		}
		// The mode travels with the line, so a row can say whether the VAT it
		// names is inside the amount shown or on top of it.
		expect(gross.expenseLines[0]?.amountMode).toBe("gross");
		expect(net.expenseLines[0]?.amountMode).toBe("net");
	});

	it("measures match capacity gross in both modes", () => {
		// A €119 invoice and a €119 plan item, both 19 % VAT. `matched_amount` is
		// gross whatever the T-view shows, so switching to net mode must not offer a
		// €100 match: that would save €100 gross and strand €19 that no longer
		// reads as open.
		const matchable = () => [
			group({
				expense_lines: [
					line({
						kind: "actual",
						amount: 119,
						vat_amount: 19,
						vat_rate: 19,
						net_amount: 100,
						label: "Catering",
						posting_external_id: "BB-catering",
						posting_detail: postingDetail({ posting_amount: -119 }),
					}),
					line({
						kind: "plan",
						amount: 119,
						vat_amount: 19,
						vat_rate: 19,
						net_amount: 100,
						label: "Catering geplant",
						plan_item_id: "plan-catering",
					}),
				],
			}),
		];

		for (const amountMode of ["gross", "net"] as const) {
			const tree = buildTAccountTree(matchable(), { amountMode });
			const candidates = collectMatchCandidates(tree);

			expect(candidates.postings.map((entry) => entry.openAmount)).toEqual([
				119,
			]);
			expect(candidates.planItems.map((entry) => entry.openAmount)).toEqual([
				119,
			]);
			expect(openPostingAmount(tree[0].expenseLines[0])).toBe(119);
		}
	});

	it("reports the gross remainder of a partly matched invoice in Netto", () => {
		// €119 booked, €60 of it already matched. What is still open is €59
		// gross — never the €100 net line minus the €60 gross match, which is
		// what made the invoice vanish from the candidates.
		const tree = buildTAccountTree(
			[
				group({
					expense_lines: [
						line({
							kind: "actual",
							amount: 119,
							vat_amount: 19,
							vat_rate: 19,
							net_amount: 100,
							label: "Catering",
							posting_external_id: "BB-catering",
							posting_detail: postingDetail({
								posting_amount: -119,
								matches: [
									match({
										id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
										posting_external_id: "BB-catering",
										plan_item_id: "plan-catering",
										matched_amount: 60,
									}),
								],
							}),
						}),
					],
				}),
			],
			{
				amountMode: "net",
				planItems: {
					"plan-catering": { label: "Catering geplant", project_id: null },
				},
			},
		);

		expect(openPostingAmount(tree[0].expenseLines[0])).toBe(59);
		expect(collectMatchCandidates(tree).postings[0]?.openAmount).toBe(59);
	});

	it("rolls a child up in the active mode", () => {
		const nested = [
			group({
				project_id: MAKEATHON,
				project_name: "Makeathon",
			}),
			group({
				project_id: HACKATHON,
				project_name: "Hackathon",
				parent_project_id: MAKEATHON,
				income_lines: [
					line({
						kind: "actual",
						direction: "income",
						amount: 11_900,
						vat_amount: 1900,
						net_amount: 10_000,
					}),
				],
			}),
		];

		const [grossParent] = buildTAccountTree(nested);
		const [netParent] = buildTAccountTree(nested, { amountMode: "net" });

		expect(grossParent.incomeLines.find((l) => l.isProjectRollup)?.amount).toBe(
			11_900,
		);
		expect(netParent.incomeLines.find((l) => l.isProjectRollup)?.amount).toBe(
			10_000,
		);
		expect(netParent.actualSaldo).toBe(10_000);
	});
});

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
					// Parked: refuses matches server-side, so never offered.
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

	it("offers open invoices and active plan item with their open amounts", () => {
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
		// The parked plan item is not on offer.
		expect(planItems.some((entry) => entry.label === "Gestrichen")).toBe(false);
	});

	it("carries the scope a match has to share", () => {
		// A plan item can only absorb the share of a posting allocated to its own
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

	it("keeps a split invoice open in the project that has not matched it", () => {
		// A €100 invoice split €50/€50 over two projects appears as one line per
		// project, but each line carries *every* match on the posting. The database
		// counts capacity per (department, project), so matching the Makeathon half
		// must leave the Hackathon half fully open — it used to disappear from the
		// candidate list together with its sibling.
		const splitLine = (projectId: string) =>
			line({
				kind: "actual",
				amount: 50,
				label: `Sammelrechnung (${projectId === MAKEATHON ? "M" : "H"})`,
				posting_external_id: "BB-split",
				project_id: projectId,
				posting_detail: postingDetail({
					posting_amount: -100,
					matches: [
						match({
							id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
							posting_external_id: "BB-split",
							plan_item_id: "plan-makeathon",
							matched_amount: 50,
						}),
					],
				}),
			});
		const tree = buildTAccountTree(
			[
				group({
					project_id: MAKEATHON,
					project_name: "Makeathon",
					expense_lines: [splitLine(MAKEATHON)],
				}),
				group({
					project_id: HACKATHON,
					project_name: "Hackathon",
					expense_lines: [
						splitLine(HACKATHON),
						line({
							kind: "plan",
							amount: 50,
							label: "Hackathon-Plan",
							plan_item_id: "plan-hackathon",
							project_id: HACKATHON,
						}),
					],
				}),
			],
			// The Makeathon plan item is fully matched, so it has no line of its
			// own: only the response-level map says which share its match spends.
			{
				planItems: {
					"plan-makeathon": { label: "Makeathon-Plan", project_id: MAKEATHON },
				},
			},
		);
		const [makeathon, hackathon] = tree;

		expect(openPostingAmount(makeathon.expenseLines[0])).toBe(0);
		expect(openPostingAmount(hackathon.expenseLines[0])).toBe(50);
		expect(
			collectMatchCandidates(tree).postings.map((entry) => [
				entry.projectId,
				entry.openAmount,
			]),
		).toEqual([[HACKATHON, 50]]);
	});

	it("never offers more than the posting itself still has open", () => {
		// An unallocated invoice matched from a project (only the automatic
		// reconciliation can produce that pairing) is spent all the same: the
		// department-level line must not re-offer the €40 that already went.
		const [node] = buildTAccountTree(
			[
				group({
					expense_lines: [
						line({
							kind: "actual",
							amount: 100,
							label: "Sammelrechnung",
							posting_external_id: "BB-loose",
							posting_detail: postingDetail({
								posting_amount: -100,
								matches: [
									match({
										id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
										posting_external_id: "BB-loose",
										plan_item_id: "plan-makeathon",
										matched_amount: 40,
									}),
								],
							}),
						}),
					],
				}),
			],
			{
				planItems: {
					"plan-makeathon": { label: "Makeathon-Plan", project_id: MAKEATHON },
				},
			},
		);

		expect(openPostingAmount(node.expenseLines[0])).toBe(60);
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

	it("names every skip, grouped by reason", () => {
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

	// Every refusal the server can send must be sayable — including the two the
	// planner and the write loop added.
	it("names a zero-value posting and a late server refusal", () => {
		const summary = summarizeAllocationResults([
			{ posting_external_id: "BB-1", applied: false, reason: "zero_amount" },
			{ posting_external_id: "BB-2", applied: false, reason: "rejected" },
		]);

		expect(summary.message).toBe(
			"0 von 2 Buchungen zugeordnet. 2 übersprungen: 1× Buchung ohne Betrag, 1× vom Server abgelehnt.",
		);
	});
});

describe("collectSubTeamOptions", () => {
	it("offers every sub-team folder the department already uses", () => {
		const options = collectSubTeamOptions(
			[
				group({ project_id: null, project_name: null }),
				group({
					project_id: null,
					project_name: "Big Makeathon",
					sub_team: "Big Makeathon",
					is_sub_team: true,
				}),
				group({
					project_id: MAKEATHON,
					project_name: "Makeathon 2026",
					sub_team: "Big Makeathon",
				}),
			],
			[{ sub_team: "Community Events" }, { sub_team: null }],
		);

		// De-duplicated across folders and projects, sorted for a stable picker.
		expect(options).toEqual(["Big Makeathon", "Community Events"]);
	});

	it("returns nothing when the department has no sub-teams", () => {
		expect(collectSubTeamOptions([group({})], [])).toEqual([]);
	});
});

describe("vatLabel", () => {
	it("names the side of the ledger instead of a generic USt", () => {
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
		// The actual balance is booked income − booked expenses; the forecast folds
		// in planned.
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
		// Parent booked income = own 3.000 + rolled 15.420; planned-only = 1.100.
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

	it("nests a project inside the sub-team folder that owns it", () => {
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

	it("sums VAT per column, booked and planned separately", () => {
		const [node] = buildTAccountTree([
			group({
				expense_lines: [
					// Input tax on the expense side.
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

	it("marks a fully matched plan item as settled and stops offering it", () => {
		// Nothing open left, but it still has to be reachable: since the plan tab
		// retired, the T-view is the only place it can be edited from.
		const [node] = buildTAccountTree([
			group({
				expense_lines: [
					line({
						kind: "plan",
						amount: 0,
						label: "Venue",
						plan_item_id: "plan-venue",
						plan_detail: planDetail({
							planned_amount: 1000,
							matched_amount: 1000,
							delta: 0,
						}),
					}),
				],
			}),
		]);

		const settled = node.expenseLines[0];
		expect(settled?.isSettled).toBe(true);
		expect(settled?.isActive).toBe(true);
		// It contributes nothing to the plan column…
		expect(node.expenseSummary.plan).toBe(0);
		// …and is not offered as a match candidate, having no capacity left.
		expect(collectMatchCandidates([node]).planItems).toEqual([]);
	});

	it("keeps a disabled plan item visible but out of every plan subtotal", () => {
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

	it("excludes a child's disabled plan item from the parent roll-up", () => {
		const tree = buildTAccountTree([
			group({ project_id: MAKEATHON, project_name: "Makeathon" }),
			group({
				project_id: HACKATHON,
				project_name: "Hackathon",
				parent_project_id: MAKEATHON,
				expense_lines: [
					line({
						kind: "plan",
						amount: 900,
						label: "Abgesagt",
						plan_item_id: "plan-cancelled-child",
						plan_detail: planDetail({ planned_amount: 900, is_active: false }),
					}),
				],
			}),
		]);

		const makeathon = tree[0];
		// The child contributes nothing, so no folder line is injected at all and
		// the parked amount cannot sneak into the parent's forecast.
		expect(makeathon.expenseLines).toHaveLength(0);
		expect(makeathon.planSaldo).toBe(0);
	});

	it("names a plan item that has no line of its own", () => {
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
			{ planItems: { "plan-venue": { label: "Venue", project_id: null } } },
		);

		expect(node.expenseLines[0]?.matches.map((m) => m.label)).toEqual([
			"Venue",
		]);
	});

	it("resolves allocation projects and match counterparts to names", () => {
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
		// A posting row names the plan item it feeds…
		expect(posting.matches.map((m) => m.label)).toEqual([
			"Preisgeld (geplant)",
		]);
		// …and the plan item names the invoice that arrived against it.
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
