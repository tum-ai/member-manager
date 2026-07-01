// Member expertise graph contract: how members are linked into clusters.
// Framework-free; consumed by the client graph builder and available to the
// server. The node/edge/graph shapes stay in the client util because they carry
// the full `Member` object, which must not leak framework/DB types in here.

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

// Broad or sparse reasons (school, location, expertise) are opt-in so the
// default graph stays legible. Expertise data is backfilled over time, so it
// stays off by default until the dataset is dense enough to be useful.
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
