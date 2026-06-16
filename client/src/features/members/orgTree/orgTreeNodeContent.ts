import {
	TUM_AI_LOGO_MARK_DARK,
	TUM_AI_LOGO_MARK_LIGHT,
} from "../../../lib/branding";
import type { Member } from "../../../types";
import { getDisplayName, getInitials } from "../orgChartShared";
import { isBoardMember, type OrgTreeNode } from "./orgTreeData";

/** Escape for safe interpolation into HTML text and double-quoted attributes. */
export function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const CARD_BASE =
	"height:100%;box-sizing:border-box;background:var(--card);color:var(--card-foreground);" +
	"border:1px solid var(--border);border-radius:var(--radius);" +
	"box-shadow:0 1px 2px rgba(0,0,0,0.06);overflow:hidden;font-family:inherit;";

const LABEL_STYLE =
	"font-size:10px;letter-spacing:0.07em;text-transform:uppercase;" +
	"color:var(--muted-foreground);font-weight:600;";

const COUNT_BADGE_STYLE =
	"display:inline-flex;align-items:center;border:1px solid var(--border);" +
	"border-radius:9999px;padding:1px 9px;font-size:11px;font-weight:500;" +
	"color:var(--muted-foreground);white-space:nowrap;";

function avatarHtml(member: Member, size: number, isBoard = false): string {
	const initials = escapeHtml(getInitials(member));
	const circle =
		`position:relative;width:${size}px;height:${size}px;border-radius:9999px;` +
		"overflow:hidden;background:var(--muted);";
	const fallback =
		`<div style="position:absolute;inset:0;display:flex;align-items:center;` +
		`justify-content:center;color:var(--muted-foreground);font-weight:600;` +
		`font-size:${Math.round(size * 0.34)}px;">${initials}</div>`;
	const url = member.avatar_url ? escapeHtml(member.avatar_url) : "";
	// crossorigin lets the avatar be drawn onto the export canvas without tainting
	// it (PNG export otherwise fails silently on cross-origin Slack avatars).
	const img = url
		? `<img src="${url}" alt="" crossorigin="anonymous" style="position:absolute;inset:0;width:100%;` +
			`height:100%;object-fit:cover;" onerror="this.style.display='none'" />`
		: "";
	const inner = `<div style="${circle}">${fallback}${img}</div>`;
	if (!isBoard) {
		return `<div style="flex:0 0 auto;width:${size}px;height:${size}px;">${inner}</div>`;
	}
	// Board indicator: a small brand badge with a star, pinned to the avatar's
	// corner (outside the clipped circle) — flags a department lead who also
	// sits on the board.
	const badge = Math.round(size * 0.4);
	const star =
		`<svg width="${Math.round(badge * 0.62)}" height="${Math.round(badge * 0.62)}" ` +
		`viewBox="0 0 24 24" fill="white"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87 ` +
		`1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z"/></svg>`;
	const badgeStyle =
		`position:absolute;right:-2px;bottom:-2px;width:${badge}px;height:${badge}px;` +
		"border-radius:9999px;background:var(--brand);border:2px solid var(--card);" +
		"display:flex;align-items:center;justify-content:center;";
	return (
		`<div style="position:relative;flex:0 0 auto;width:${size}px;height:${size}px;">` +
		inner +
		`<div title="Board member" style="${badgeStyle}">${star}</div>` +
		`</div>`
	);
}

/** A uniform vertical chip: avatar, name, and an optional role subtitle. */
function personChip(
	member: Member,
	subLabel?: string,
	isBoard?: boolean,
): string {
	const sub = subLabel
		? `<div style="font-size:10px;color:var(--muted-foreground);text-align:center;` +
			`line-height:1.2;">${escapeHtml(subLabel)}</div>`
		: "";
	return (
		`<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:96px;">` +
		avatarHtml(member, 46, isBoard) +
		`<div style="font-size:12px;font-weight:600;text-align:center;line-height:1.2;` +
		`display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">` +
		`${escapeHtml(getDisplayName(member))}</div>` +
		sub +
		`</div>`
	);
}

function renderBoard(node: OrgTreeNode): string {
	const seats = node.board ?? [];
	const count = node.memberCount ?? 0;
	const logo =
		`<img class="org-logo-light" src="${escapeHtml(TUM_AI_LOGO_MARK_LIGHT)}" alt="" ` +
		`style="width:22px;height:22px;object-fit:contain;flex:0 0 auto;" />` +
		`<img class="org-logo-dark" src="${escapeHtml(TUM_AI_LOGO_MARK_DARK)}" alt="" ` +
		`style="width:22px;height:22px;object-fit:contain;flex:0 0 auto;" />`;
	const header =
		`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">` +
		`<div style="display:flex;align-items:center;gap:8px;min-width:0;">${logo}` +
		`<div style="font-size:14px;font-weight:700;line-height:1.2;">${escapeHtml(node.title)}</div></div>` +
		`<span style="${COUNT_BADGE_STYLE}">${count} member${count === 1 ? "" : "s"}</span>` +
		`</div>`;
	const body =
		seats.length > 0
			? `<div style="display:flex;flex-wrap:wrap;gap:16px 18px;justify-content:center;">` +
				seats.map((seat) => personChip(seat.member, seat.role)).join("") +
				`</div>`
			: `<div style="font-size:12px;color:var(--muted-foreground);">No board members yet.</div>`;
	return (
		`<div style="${CARD_BASE}border-top:3px solid var(--brand);display:flex;flex-direction:column;padding:16px 18px;">` +
		header +
		body +
		`</div>`
	);
}

function renderDepartment(node: OrgTreeNode): string {
	const leads = node.leads ?? [];
	const badge =
		node.memberCount != null
			? `<span style="${COUNT_BADGE_STYLE}">${node.memberCount} member${node.memberCount === 1 ? "" : "s"}</span>`
			: "";
	const header =
		`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">` +
		`<div style="min-width:0;">` +
		`<div style="${LABEL_STYLE}">${escapeHtml(node.roleLabel)}</div>` +
		`<div style="margin-top:2px;font-size:15px;font-weight:600;line-height:1.2;">${escapeHtml(node.title)}</div>` +
		`</div>${badge}</div>`;
	const body =
		leads.length > 0
			? `<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:14px;">` +
				leads
					.map((member) => personChip(member, undefined, isBoardMember(member)))
					.join("") +
				`</div>`
			: `<div style="margin-top:14px;font-size:12px;color:var(--muted-foreground);">No lead assigned yet.</div>`;
	return (
		`<div style="${CARD_BASE}border-top:3px solid var(--brand);display:flex;flex-direction:column;padding:14px 16px;">` +
		header +
		body +
		`</div>`
	);
}

function renderPerson(node: OrgTreeNode): string {
	const member = node.member;
	if (!member) return `<div style="${CARD_BASE}"></div>`;
	return (
		`<div style="${CARD_BASE}display:flex;align-items:center;gap:12px;padding:14px 16px;">` +
		avatarHtml(member, 42) +
		`<div style="min-width:0;">` +
		`<div style="font-size:14px;font-weight:600;line-height:1.25;display:-webkit-box;` +
		`-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(getDisplayName(member))}</div>` +
		`<div style="margin-top:2px;font-size:12px;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(node.roleLabel)}</div>` +
		`</div></div>`
	);
}

/** Render a node's card as an HTML string (d3-org-chart `nodeContent`). */
export function renderNodeContent(node: OrgTreeNode): string {
	switch (node.kind) {
		case "board":
			return renderBoard(node);
		case "department":
			return renderDepartment(node);
		default:
			return renderPerson(node);
	}
}

/** Expand/collapse button (d3-org-chart `buttonContent`). */
export function renderButtonContent(params: {
	node: { children?: unknown[]; data: { _directSubordinatesPaging?: number } };
}): string {
	const expanded =
		Array.isArray(params.node.children) && params.node.children.length > 0;
	const count = params.node.data._directSubordinatesPaging ?? 0;
	const path = expanded ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6";
	const chevron =
		`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
		`stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
	return (
		`<div style="display:flex;align-items:center;gap:4px;border:1px solid var(--border);` +
		`border-radius:9999px;padding:3px 9px;background:var(--card);color:var(--muted-foreground);` +
		`font-size:11px;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,0.08);">` +
		chevron +
		`<span>${count}</span></div>`
	);
}

/** Per-node dimensions; sizes the board strip and department nodes to content. */
export function getNodeSize(node: OrgTreeNode): {
	width: number;
	height: number;
} {
	if (node.kind === "person") return { width: 240, height: 92 };

	if (node.kind === "board") {
		const seats = node.board?.length ?? 0;
		const perRow = Math.min(Math.max(seats, 1), 5);
		const rows = Math.max(1, Math.ceil(seats / 5));
		return {
			width: Math.max(320, perRow * 112 + 56),
			height: 70 + rows * 100,
		};
	}

	// department
	const leads = node.leads?.length ?? 0;
	if (leads === 0) return { width: 260, height: 116 };
	const perRow = Math.min(leads, 3);
	const rows = Math.ceil(leads / 3);
	return {
		width: Math.max(260, perRow * 104 + 48),
		height: 92 + rows * 92,
	};
}
