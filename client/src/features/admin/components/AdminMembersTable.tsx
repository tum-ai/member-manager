import {
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	ExternalLink,
	Pencil,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { sortableColumns } from "@/features/admin/adminDatabaseViewTypes";
import {
	type AdminMember,
	type AdminSortKey,
	getAdminMemberInitials,
	hasDataPrivacyNoticeAgreement,
	hasMandateAgreement,
	hasPrivacyAgreement,
} from "@/features/admin/adminUtils";
import { proxiedAvatarUrl } from "@/lib/avatarUrl";
import { BOARD_MEMBER_ROLE } from "@/lib/constants";
import { isLinkedinProfileUrl } from "@/lib/linkedin";
import {
	getMemberStatusLabel,
	getOperationalDepartment,
} from "@/lib/memberMetadata";
import { cn } from "@/lib/utils";
import { AgreementChip } from "./AgreementChip";

interface AdminMembersTableProps {
	rows: AdminMember[];
	sortBy: AdminSortKey;
	sortAsc: boolean;
	onSortChange: (column: AdminSortKey) => void;
	onEditMember: (member: AdminMember) => void;
	loadingMessage: string;
}

function getResolvedStatus(member: AdminMember): string {
	return member.member_status || (member.active ? "active" : "inactive");
}

export function AdminMembersTable({
	rows,
	sortBy,
	sortAsc,
	onSortChange,
	onEditMember,
	loadingMessage,
}: AdminMembersTableProps) {
	return (
		<GlassCard variant="elevated" className="mb-6 overflow-hidden">
			<div className="px-6 pt-6 pb-4">
				<h2 className="text-lg font-semibold">Members</h2>
				<p className="mt-0.5 text-sm text-muted-foreground">{loadingMessage}</p>
			</div>
			<div className="w-full overflow-x-auto">
				<Table className="min-w-[1620px]">
					<TableHeader>
						<TableRow>
							{sortableColumns.map((column) => {
								const isActive = sortBy === column.key;
								const SortIcon = !isActive
									? ChevronsUpDown
									: sortAsc
										? ChevronUp
										: ChevronDown;
								return (
									<TableHead
										key={column.key}
										className="border-b bg-card"
										style={{ minWidth: column.width }}
									>
										<button
											type="button"
											onClick={() => onSortChange(column.key)}
											className={cn(
												"inline-flex items-center gap-1 font-medium",
												isActive ? "text-foreground" : "text-muted-foreground",
											)}
										>
											{column.label}
											<SortIcon className="size-4" />
										</button>
									</TableHead>
								);
							})}
						</TableRow>
					</TableHeader>

					<TableBody>
						{rows.map((row) => {
							const sepaAccepted = hasMandateAgreement(row);
							const privacyAccepted = hasPrivacyAgreement(row);
							const dataPrivacyNoticeAccepted =
								hasDataPrivacyNoticeAgreement(row);
							const fullName =
								`${row.given_name} ${row.surname}`.trim() || "Unnamed member";
							const memberStatus = getResolvedStatus(row);

							return (
								<TableRow
									key={row.user_id}
									className={cn(memberStatus !== "active" && "opacity-[0.84]")}
								>
									<TableCell>
										<div className="flex flex-row items-center gap-3">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												onClick={() => onEditMember(row)}
												aria-label={`Edit member ${fullName}`}
												className="rounded-full text-brand"
											>
												<Pencil className="size-4" />
											</Button>
											<Avatar className="size-11 bg-muted">
												<AvatarImage
													src={proxiedAvatarUrl(row.avatar_url)}
													alt={fullName}
												/>
												<AvatarFallback className="bg-muted font-bold text-foreground">
													{getAdminMemberInitials(row)}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0">
												<p className="overflow-hidden font-bold leading-tight text-ellipsis whitespace-nowrap">
													{fullName}
												</p>
												<p className="overflow-hidden text-sm text-muted-foreground text-ellipsis whitespace-nowrap">
													{row.email}
												</p>
											</div>
										</div>
									</TableCell>

									<TableCell>
										{getOperationalDepartment(row.department) || "—"}
									</TableCell>
									<TableCell>{row.member_role || "Member"}</TableCell>
									<TableCell>
										{row.board_role === BOARD_MEMBER_ROLE ? (
											<Badge variant="accent" className="font-semibold">
												{BOARD_MEMBER_ROLE}
											</Badge>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell>{row.phone || "—"}</TableCell>
									<TableCell>
										{isLinkedinProfileUrl(row.linkedin_profile_url) ? (
											<Button
												variant="ghost"
												size="sm"
												asChild
												className="px-2 text-brand"
											>
												<a
													href={row.linkedin_profile_url.trim()}
													target="_blank"
													rel="noopener noreferrer"
												>
													<ExternalLink className="size-4" />
													View
												</a>
											</Button>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell>{row.public_location || "—"}</TableCell>
									<TableCell className="font-mono">
										{row.sepa?.iban || "—"}
									</TableCell>
									<TableCell className="font-mono">
										{row.sepa?.bic || "—"}
									</TableCell>
									<TableCell>{row.sepa?.bank_name || "—"}</TableCell>
									<TableCell>
										<AgreementChip accepted={sepaAccepted} />
									</TableCell>
									<TableCell>
										<AgreementChip accepted={privacyAccepted} />
									</TableCell>
									<TableCell>
										<AgreementChip accepted={dataPrivacyNoticeAccepted} />
									</TableCell>
									<TableCell>
										<Badge
											variant={memberStatus === "active" ? "accent" : "neutral"}
											className="font-semibold"
										>
											{getMemberStatusLabel(memberStatus)}
										</Badge>
									</TableCell>
								</TableRow>
							);
						})}

						{rows.length === 0 && (
							<TableRow>
								<TableCell colSpan={sortableColumns.length}>
									<div className="py-14 text-center">
										<p className="mb-1 font-bold">
											No members match the current filters
										</p>
										<p className="text-muted-foreground">
											Try broadening the search or resetting the agreement
											filters.
										</p>
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</GlassCard>
	);
}
