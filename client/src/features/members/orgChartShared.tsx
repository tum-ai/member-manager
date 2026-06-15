import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BOARD_MEMBER_ROLE } from "../../lib/constants";
import type { Member } from "../../types";

export function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase();
}

export function getDisplayName(member: Member): string {
	return `${member.given_name} ${member.surname}`.trim() || "Unnamed Member";
}

export function getBoardBadgeLabel(member: Member): string | undefined {
	const explicitRole =
		typeof member.board_role === "string"
			? member.board_role.trim()
			: typeof member.boardRole === "string"
				? member.boardRole.trim()
				: "";
	if (explicitRole === BOARD_MEMBER_ROLE) return "Board member";

	return member.department === "Board" ? "Board member" : undefined;
}

export function getMemberCountLabel(count: number): string {
	return `${count} member${count !== 1 ? "s" : ""}`;
}

export function OrgChartPerson({
	member,
	lead,
	boardRole,
}: {
	member: Member;
	lead?: boolean;
	boardRole?: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<Avatar
				className={cn(
					"shrink-0 bg-muted text-foreground",
					lead ? "size-10" : "size-9",
				)}
			>
				<AvatarImage
					src={member.avatar_url || undefined}
					alt={getDisplayName(member)}
				/>
				<AvatarFallback
					className={cn(
						"bg-muted font-semibold text-muted-foreground",
						lead ? "text-sm" : "text-xs",
					)}
				>
					{getInitials(member)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0">
				<p
					className={cn(
						"truncate leading-tight",
						lead ? "font-semibold" : "font-medium",
					)}
				>
					{getDisplayName(member)}
				</p>
				{boardRole && (
					<Badge variant="accent" className="mt-1">
						{boardRole}
					</Badge>
				)}
			</div>
		</div>
	);
}

export function renderMembers(
	members: Member[],
	options: {
		showBoardBadge?: boolean;
		lead?: boolean;
	} = {},
) {
	return members.map((member) => (
		<OrgChartPerson
			key={member.user_id}
			member={member}
			lead={options.lead}
			boardRole={
				options.showBoardBadge ? getBoardBadgeLabel(member) : undefined
			}
		/>
	));
}

export function OrgChartTeamCard({
	title,
	count,
	description,
	badges,
	primaryLabel,
	primaryMembers,
	primaryEmpty,
	secondaryLabel,
	secondaryMembers,
	secondaryEmpty,
	showBoardBadge,
}: {
	title: string;
	count: number;
	description?: string;
	badges?: ReactNode;
	primaryLabel: string;
	primaryMembers: Member[];
	primaryEmpty: string;
	secondaryLabel: string;
	secondaryMembers: Member[];
	secondaryEmpty: string;
	showBoardBadge?: boolean;
}) {
	return (
		<div className="flex h-full flex-col rounded-xl border bg-card p-5">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="font-semibold">{title}</p>
					{description && (
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					)}
					{badges && (
						<div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>
					)}
				</div>
				<Badge variant="outline" className="shrink-0">
					{getMemberCountLabel(count)}
				</Badge>
			</div>

			<p className="mb-2.5 text-xs font-medium text-muted-foreground">
				{primaryLabel}
			</p>
			<div className="mb-5 grid gap-3">
				{primaryMembers.length > 0 ? (
					renderMembers(primaryMembers, { showBoardBadge, lead: true })
				) : (
					<p className="text-sm text-muted-foreground">{primaryEmpty}</p>
				)}
			</div>

			<p className="mb-2.5 text-xs font-medium text-muted-foreground">
				{secondaryLabel}
			</p>
			<div className="grid gap-3">
				{secondaryMembers.length > 0 ? (
					renderMembers(secondaryMembers, { showBoardBadge })
				) : (
					<p className="text-sm text-muted-foreground">{secondaryEmpty}</p>
				)}
			</div>
		</div>
	);
}
