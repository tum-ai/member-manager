import { MapPin, Search } from "lucide-react";
import type * as React from "react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import GlassCard from "../../components/ui/GlassCard";
import { useMembersListData } from "../../hooks/useMembersListData";
import { proxiedAvatarUrl } from "../../lib/avatarUrl";
import {
	BOARD_MEMBER_ROLE,
	DEGREE_TYPES,
	DEPARTMENTS,
	MEMBER_ROLES,
} from "../../lib/constants";
import { isLinkedinProfileUrl } from "../../lib/linkedin";
import {
	buildMemberNameSearchText,
	getEducationEntries,
	getMemberStatusLabel,
	getOperationalDepartment,
	splitDegree,
} from "../../lib/memberMetadata";
import type { Member } from "../../types";

const ALL_VALUE = "__all__";

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
			{...props}
		>
			<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
		</svg>
	);
}

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	const email = member.email?.charAt(0) || "";
	return (first + last || email).toUpperCase();
}

function getBoardBadgeLabel(member: Member): string | undefined {
	if (member.member_role === "President") return "President";
	if (member.member_role === "Vice-President") return "Vice-President";

	const explicitRole =
		typeof member.board_role === "string"
			? member.board_role.trim()
			: typeof member.boardRole === "string"
				? member.boardRole.trim()
				: "";
	if (explicitRole === BOARD_MEMBER_ROLE) return "Board member";

	return member.department === "Board" ? "Board member" : undefined;
}

function isBoardOnlyMember(member: Member): boolean {
	return (
		!getOperationalDepartment(member.department) &&
		(member.board_role === BOARD_MEMBER_ROLE || member.department === "Board")
	);
}

export default function MemberList() {
	const { members, isLoading, error } = useMembersListData();
	const [search, setSearch] = useState("");
	const [department, setDepartment] = useState("");
	const [role, setRole] = useState("");
	const [memberStatus, setMemberStatus] = useState("");
	const [degreeType, setDegreeType] = useState("");
	const [degreeProgram, setDegreeProgram] = useState("");

	const degreePrograms = useMemo(() => {
		if (!members) return [];
		return [
			...new Set(
				members.flatMap((member) =>
					getEducationEntries(member.degree, member.school).map(
						(entry) => splitDegree(entry.degree).program,
					),
				),
			),
		]
			.filter((program) => program !== "")
			.sort((left, right) => left.localeCompare(right));
	}, [members]);

	const filtered = useMemo(() => {
		if (!members) return [];
		const q = search.trim().toLowerCase();
		return members.filter((m) => {
			const educationEntries = getEducationEntries(m.degree, m.school);
			const degreeMetadata = educationEntries.map((entry) =>
				splitDegree(entry.degree),
			);
			const name = buildMemberNameSearchText(
				m.given_name,
				m.surname,
			).toLowerCase();
			const normalizedDepartment = getOperationalDepartment(m.department);
			const status = m.member_status || (m.active ? "active" : "inactive");
			const statusLabel = getMemberStatusLabel(status).toLowerCase();
			const dept = (normalizedDepartment || "").toLowerCase();
			const memberRole = (m.member_role || "").toLowerCase();
			const boardRole = (m.board_role || "").toLowerCase();
			const batch = (m.batch || "").toLowerCase();
			const degree = (m.degree || "").toLowerCase();
			const school = (m.school || "").toLowerCase();
			const publicLocation = (m.public_location || "").toLowerCase();
			if (
				q &&
				!(
					name.includes(q) ||
					dept.includes(q) ||
					memberRole.includes(q) ||
					boardRole.includes(q) ||
					batch.includes(q) ||
					degree.includes(q) ||
					school.includes(q) ||
					statusLabel.includes(q) ||
					publicLocation.includes(q)
				)
			) {
				return false;
			}
			if (department && normalizedDepartment !== department) return false;
			if (role && m.member_role !== role) return false;
			if (memberStatus && status !== memberStatus) return false;
			if (
				degreeType &&
				!degreeMetadata.some((entry) => entry.type === degreeType)
			) {
				return false;
			}
			if (
				degreeProgram &&
				!degreeMetadata.some((entry) => entry.program === degreeProgram)
			) {
				return false;
			}
			return true;
		});
	}, [
		members,
		search,
		department,
		role,
		memberStatus,
		degreeProgram,
		degreeType,
	]);

	if (isLoading) {
		return <MemberListSkeleton />;
	}

	if (error) {
		return (
			<div className="py-16 text-center">
				<p className="text-destructive">
					Failed to load members. Please try again later.
				</p>
			</div>
		);
	}

	return (
		<div>
			<GlassCard variant="elevated" className="mb-8 overflow-hidden">
				<div className="p-6 md:p-8">
					<div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
						<div className="max-w-[620px]">
							<h2 className="mb-1.5 text-2xl font-bold">All Members</h2>
							<p className="text-muted-foreground">
								Browse the TUM.ai member and alumni network and search across
								profiles.
							</p>
						</div>

						<div className="w-full max-w-[340px]">
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search members..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-9"
								/>
							</div>
						</div>
					</div>

					<div className="mt-6 flex flex-wrap items-end gap-4">
						<div className="grid gap-1.5">
							<Label htmlFor="member-list-department">Department</Label>
							<Select
								value={department || ALL_VALUE}
								onValueChange={(value) =>
									setDepartment(value === ALL_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									id="member-list-department"
									aria-label="Department"
									className="min-w-[220px]"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_VALUE}>All</SelectItem>
									{DEPARTMENTS.map((item) => (
										<SelectItem key={item} value={item}>
											{item}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<Label htmlFor="member-list-role">Role</Label>
							<Select
								value={role || ALL_VALUE}
								onValueChange={(value) =>
									setRole(value === ALL_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									id="member-list-role"
									aria-label="Role"
									className="min-w-[220px]"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_VALUE}>All</SelectItem>
									{MEMBER_ROLES.filter(
										(item) => (item as string) !== "Alumni",
									).map((item) => (
										<SelectItem key={item} value={item}>
											{item}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<Label htmlFor="member-list-status">Status</Label>
							<Select
								value={memberStatus || ALL_VALUE}
								onValueChange={(value) =>
									setMemberStatus(value === ALL_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									id="member-list-status"
									aria-label="Status"
									className="min-w-[180px]"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_VALUE}>All</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="alumni">Alumni</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<Label htmlFor="member-list-degree">Degree</Label>
							<Select
								value={degreeType || ALL_VALUE}
								onValueChange={(value) =>
									setDegreeType(value === ALL_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									id="member-list-degree"
									aria-label="Degree"
									className="min-w-[220px]"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_VALUE}>All</SelectItem>
									{DEGREE_TYPES.map((item) => (
										<SelectItem key={item} value={item}>
											{item}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-1.5">
							<Label htmlFor="member-list-program">Major / Program</Label>
							<Select
								value={degreeProgram || ALL_VALUE}
								onValueChange={(value) =>
									setDegreeProgram(value === ALL_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									id="member-list-program"
									aria-label="Major / Program"
									className="min-w-[240px]"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ALL_VALUE}>All</SelectItem>
									{degreePrograms.map((item) => (
										<SelectItem key={item} value={item}>
											{item}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<p className="text-sm text-muted-foreground">
							{filtered.length} member profile
							{filtered.length !== 1 ? "s" : ""}
						</p>
					</div>
				</div>
			</GlassCard>

			{filtered.length === 0 ? (
				<GlassCard className="py-16 text-center">
					<p className="text-muted-foreground">
						{search ? "No members match your search." : "No members found."}
					</p>
				</GlassCard>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					{filtered.map((member) => (
						<MemberCard key={member.user_id} member={member} />
					))}
				</div>
			)}
		</div>
	);
}

interface MemberCardProps {
	member: Member;
}

function MemberCard({ member }: MemberCardProps) {
	const fullName = `${member.given_name} ${member.surname}`.trim();
	const displayName = fullName || member.email || "Unnamed Member";
	const operationalDepartment = getOperationalDepartment(member.department);
	const boardBadgeLabel = getBoardBadgeLabel(member);
	const status =
		member.member_status || (member.active ? "active" : "inactive");
	const educationEntries = getEducationEntries(member.degree, member.school);
	const showMemberRole = Boolean(
		member.member_role && !isBoardOnlyMember(member),
	);
	const linkedinProfileUrl = isLinkedinProfileUrl(member.linkedin_profile_url)
		? member.linkedin_profile_url.trim()
		: null;

	return (
		<GlassCard variant="interactive" className="h-full">
			<div className="p-5">
				<div className="flex items-start gap-4">
					<Avatar className="size-14 shrink-0 bg-muted text-foreground">
						<AvatarImage
							src={proxiedAvatarUrl(member.avatar_url)}
							alt={displayName}
						/>
						<AvatarFallback className="bg-muted text-lg font-bold text-foreground">
							{getInitials(member)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-base font-bold leading-snug">
							{displayName}
						</p>

						{showMemberRole && (
							<p className="text-sm leading-snug text-brand">
								{member.member_role}
							</p>
						)}

						{operationalDepartment && (
							<p className="text-sm leading-snug text-muted-foreground">
								{operationalDepartment}
							</p>
						)}
					</div>
					{linkedinProfileUrl && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										asChild
										variant="ghost"
										size="icon"
										className="-mt-1 -mr-1 shrink-0 self-start text-brand hover:bg-brand/10"
									>
										<a
											aria-label="View LinkedIn profile"
											href={linkedinProfileUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											<LinkedinIcon className="size-4" />
										</a>
									</Button>
								</TooltipTrigger>
								<TooltipContent>View LinkedIn profile</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>

				<div className="mt-4 flex flex-wrap gap-1.5">
					{status !== "active" && (
						<Badge variant="outline">{getMemberStatusLabel(status)}</Badge>
					)}
					{boardBadgeLabel && (
						<Badge variant="outline">{boardBadgeLabel}</Badge>
					)}
					{member.batch && <Badge variant="outline">{member.batch}</Badge>}
					{educationEntries.map((entry) => (
						<Badge
							key={`${entry.degree}-${entry.school}`}
							variant="outline"
							className="max-w-full overflow-hidden"
						>
							<span className="overflow-hidden text-ellipsis">
								{[entry.degree, entry.school].filter(Boolean).join(" · ")}
							</span>
						</Badge>
					))}
				</div>

				{member.public_location && (
					<div className="mt-4 flex flex-col gap-1.5 border-t pt-3">
						<div className="flex items-center gap-2">
							<MapPin className="size-4 text-muted-foreground opacity-75" />
							<p className="truncate text-[0.825rem] text-muted-foreground">
								{member.public_location}
							</p>
						</div>
					</div>
				)}
			</div>
		</GlassCard>
	);
}

// Filter selects mirror the live widths: department, role, status, degree, program.
const FILTER_WIDTHS = [
	"w-[220px]",
	"w-[220px]",
	"w-[180px]",
	"w-[220px]",
	"w-[240px]",
];

export function MemberListSkeleton() {
	return (
		<SkeletonRegion label="Loading members">
			<GlassCard variant="elevated" className="mb-8 overflow-hidden">
				<div className="p-6 md:p-8">
					<div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
						<div className="max-w-[620px] space-y-2">
							<Skeleton className="h-7 w-44" />
							<Skeleton className="h-4 w-96 max-w-full" />
						</div>
						<Skeleton className="h-9 w-full max-w-[340px] rounded-md" />
					</div>

					<div className="mt-6 flex flex-wrap items-end gap-4">
						{FILTER_WIDTHS.map((width) => (
							<div key={width} className="grid gap-1.5">
								<Skeleton className="h-4 w-20" />
								<Skeleton className={`h-9 max-w-full rounded-md ${width}`} />
							</div>
						))}
						<Skeleton className="h-4 w-28" />
					</div>
				</div>
			</GlassCard>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{Array.from({ length: 9 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
					<MemberCardSkeleton key={i} />
				))}
			</div>
		</SkeletonRegion>
	);
}

function MemberCardSkeleton() {
	return (
		<GlassCard className="h-full">
			<div className="p-5">
				<div className="flex items-start gap-4">
					<Skeleton className="size-14 shrink-0 rounded-full" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-5 w-3/4" />
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				</div>
				<div className="mt-4 flex flex-wrap gap-1.5">
					<Skeleton className="h-5 w-16 rounded-full" />
					<Skeleton className="h-5 w-24 rounded-full" />
				</div>
			</div>
		</GlassCard>
	);
}
