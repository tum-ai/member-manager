import { describe, expect, it } from "vitest";
import {
	tAccountGroup as group,
	tAccountLine as line,
} from "@/features/finance/financeTAccountFixtures";
import { buildTAccountTree } from "./financeTAccountUtils";

const MAKEATHON = "11111111-1111-4111-8111-111111111111";
const HACKATHON = "22222222-2222-4222-8222-222222222222";

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

		expect(node.expenseSummary).toEqual({ ist: 1540, plan: 800 });
		expect(node.incomeSummary).toEqual({ ist: 3000, plan: 0 });
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
		expect(makeathon.incomeSummary).toEqual({ ist: 18_420, plan: 1100 });
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
