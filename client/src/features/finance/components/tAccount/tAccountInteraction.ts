import type { TAccountNode } from "@/features/finance/financeTAccountUtils";

// Everything the T-view's rows and folders can *do*, bundled into one prop so it
// travels from the section down to a line row without five separate props at
// every level. Absent (or `canWrite: false`) means the read-only view: rows
// still expand (FR-K2/K4), nothing is selectable or writable (FR-K6).
export interface TAccountInteraction {
	canWrite: boolean;
	isSelected: (postingExternalId: string) => boolean;
	onToggleSelect: (postingExternalId: string) => void;
	// Open the project dialog for this node: a department or sub-team folder
	// creates a project, a project creates a sub-project (FR-L3).
	onCreateProject: (node: TAccountNode) => void;
	// Add this single invoice to an existing project from its expanded row
	// (FR-L2). The amount travels along so the dialog can state what it is about
	// to move without looking the line up again.
	onAssignPosting: (postingExternalId: string, amount: number) => void;
}
