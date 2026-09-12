import type {
	TAccountDisplayLine,
	TAccountNode,
} from "@/features/finance/financeTAccountUtils";

// Everything the T-view's rows and folders can *do*, bundled into one prop so it
// travels from the section down to a line row without a dozen separate props at
// every level. Absent (or `canWrite: false`) means the read-only view: rows
// still expand, nothing is selectable or writable.
export interface TAccountInteraction {
	canWrite: boolean;
	// A finance reviewer (`finance.review`), not merely someone who may write
	// their own department. The split editor replaces every allocation of a
	// posting through the reviewer-only PUT endpoint, so `canWrite` is too wide a
	// gate for it — an ordinary department member offered that action would only
	// ever get a 403 back.
	canReview: boolean;

	// --- Invoices ------------------------------------------------------------
	isSelected: (postingExternalId: string) => boolean;
	onToggleSelect: (postingExternalId: string) => void;
	// Open the allocation editor on this posting: edit an existing split in place
	// or create the first one on a posting that has none. Reviewer-only, like the
	// endpoint behind it — a split posting is refused by the fast path and sent
	// here, and since Abgleich retired this is the only way in.
	onEditSplit: (line: TAccountDisplayLine) => void;
	// Ask another department to take this posting. The only allocation change a
	// department member cannot make directly, so it stays a request.
	onRequestReallocation: (line: TAccountDisplayLine) => void;
	// Add this single invoice to an existing project from its expanded row. The
	// amount travels along so the dialog can state what it is about to move
	// without looking the line up again.
	onAssignPosting: (postingExternalId: string, amount: number) => void;

	// --- Projects ------------------------------------------------------------
	// Open the project dialog for this node: a department or sub-team folder
	// creates a project, a project creates a sub-project.
	onCreateProject: (node: TAccountNode) => void;
	// Remove a project again. Its invoices and plan items are detached, not
	// deleted — they fall back to the department.
	onDeleteProject: (node: TAccountNode) => void;

	// --- Plan items ----------------------------------------------------------
	// Create one on this node, with its project preset.
	onCreatePlanItem: (node: TAccountNode) => void;
	// Edit in place.
	onEditPlanItem: (line: TAccountDisplayLine) => void;
	// Park or revive one.
	onTogglePlanItem: (planItemId: string, isActive: boolean) => void;
	// Set the planned amount to what actually arrived.
	onCorrectPlanToActual: (planItemId: string, matchedAmount: number) => void;
	// Match from either side: from a plan item pick an invoice, from an invoice
	// pick a plan item.
	onMatchFromPlanItem: (line: TAccountDisplayLine) => void;
	onMatchFromPosting: (line: TAccountDisplayLine) => void;
	// Detach a match; the server walks the status back with it.
	onDetachMatch: (matchId: string) => void;
	// Remove a plan item outright. Only reachable here since the plan tab
	// retired; parking it is the reversible alternative.
	onDeletePlanItem: (planItemId: string, label: string) => void;
}
