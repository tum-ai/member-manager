/** Shared reason metadata for the client-side member graph. */
export const MEMBER_GRAPH_REASON_KINDS = [
	"batch",
	"department",
	"field",
	"research",
	"school",
	"location",
	"expertise",
] as const;

export type MemberGraphReasonKind = (typeof MEMBER_GRAPH_REASON_KINDS)[number];

export const DEFAULT_MEMBER_GRAPH_REASON_KINDS = [
	"batch",
	"department",
	"field",
	"research",
] as const satisfies readonly MemberGraphReasonKind[];

export interface MemberGraphReason {
	kind: MemberGraphReasonKind;
	label: string;
	value: string;
}
