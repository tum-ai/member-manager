import type {
	TAccountDisplayLine,
	TAccountNode,
} from "@/features/finance/financeTAccountUtils";

// Everything the T-view's rows and folders can *do*, bundled into one prop so it
// travels from the section down to a line row without a dozen separate props at
// every level. Absent (or `canWrite: false`) means the read-only view: rows
// still expand (FR-K2/K4), nothing is selectable or writable (FR-K6).
export interface TAccountInteraction {
	canWrite: boolean;

	// --- Invoices (FR-K1, FR-L2) ---------------------------------------------
	isSelected: (postingExternalId: string) => boolean;
	onToggleSelect: (postingExternalId: string) => void;
	// Edit an existing split in place. Reviewer-only, like the endpoint behind
	// it — a split posting is refused by the fast path and sent here (FR-L5).
	onEditSplit: (line: TAccountDisplayLine) => void;
	// Ask another department to take this posting. The only allocation change a
	// department member cannot make directly, so it stays a request (FR-O).
	onRequestReallocation: (line: TAccountDisplayLine) => void;
	// Add this single invoice to an existing project from its expanded row
	// (FR-L2). The amount travels along so the dialog can state what it is about
	// to move without looking the line up again.
	onAssignPosting: (postingExternalId: string, amount: number) => void;

	// --- Projects (FR-L1, FR-L3) ---------------------------------------------
	// Open the project dialog for this node: a department or sub-team folder
	// creates a project, a project creates a sub-project (FR-L3).
	onCreateProject: (node: TAccountNode) => void;

	// --- Planposten (FR-M) ----------------------------------------------------
	// Create one on this node, with its project preset (FR-M1).
	onCreatePlanItem: (node: TAccountNode) => void;
	// Edit in place (FR-M2).
	onEditPlanItem: (line: TAccountDisplayLine) => void;
	// Park or revive one (FR-M3).
	onTogglePlanItem: (planItemId: string, isActive: boolean) => void;
	// Set the planned amount to what actually arrived (FR-M6).
	onCorrectPlanToActual: (planItemId: string, matchedAmount: number) => void;
	// Match from either side (FR-M5): from a Planposten pick an invoice, from an
	// invoice pick a Planposten.
	onMatchFromPlanItem: (line: TAccountDisplayLine) => void;
	onMatchFromPosting: (line: TAccountDisplayLine) => void;
	// Detach a match; the server walks the status back with it (FR-M7).
	onDetachMatch: (matchId: string) => void;
	// Remove a Planposten outright. Only reachable here since the plan tab
	// retired (FR-O); parking it (FR-M3) is the reversible alternative.
	onDeletePlanItem: (planItemId: string, label: string) => void;
}
