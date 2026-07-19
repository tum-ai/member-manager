import { GitMerge, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import type { MemberDuplicateCandidate } from "@/features/admin/adminTypes";
import { getMemberStatusLabel } from "@/lib/memberMetadata";

interface AdminDuplicateCandidatesPanelProps {
	candidates: MemberDuplicateCandidate[];
	error?: Error | null;
	onOpenMerge: (candidate: MemberDuplicateCandidate) => void;
}

function getMemberLabel(member: MemberDuplicateCandidate["members"][number]) {
	const name = `${member.given_name} ${member.surname}`.trim();
	return name || member.email || member.user_id;
}

export function AdminDuplicateCandidatesPanel({
	candidates,
	error,
	onOpenMerge,
}: AdminDuplicateCandidatesPanelProps) {
	if (candidates.length === 0 && !error) {
		return null;
	}

	return (
		<GlassCard variant="elevated" className="mb-6">
			<div className="flex flex-col gap-4 p-6">
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
							<ShieldAlert className="size-5" />
						</div>
						<div>
							<h2 className="text-lg font-semibold">
								Possible duplicate members
							</h2>
							<p className="mt-1 max-w-3xl text-sm text-muted-foreground">
								{error
									? "Duplicate detection is temporarily unavailable. The rest of the admin workspace remains usable."
									: "Review likely duplicate accounts before merging. The target profile stays canonical; the source account is merged away."}
							</p>
						</div>
					</div>
					<Badge
						variant={error ? "neutral" : "accent"}
						className="w-fit font-semibold"
					>
						{error
							? "Unavailable"
							: `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`}
					</Badge>
				</div>

				{error ? (
					<div className="rounded-lg bg-muted/45 p-4 text-sm text-muted-foreground">
						{error.message}
					</div>
				) : null}

				<div className="grid gap-3">
					{candidates.map((candidate) => (
						<div
							key={candidate.id}
							className="flex flex-col gap-3 rounded-lg bg-muted/45 p-4 md:flex-row md:items-center md:justify-between"
						>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<Badge
										variant={
											candidate.confidence === "high" ? "accent" : "neutral"
										}
									>
										{candidate.confidence}
									</Badge>
									<p className="font-semibold">{candidate.reason}</p>
								</div>
								<div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
									{candidate.members.map((member) => (
										<span
											key={member.user_id}
											className="rounded-full bg-background px-3 py-1"
										>
											{getMemberLabel(member)}
											{member.email ? ` - ${member.email}` : ""}
											{" - "}
											{getMemberStatusLabel(
												member.member_status ||
													(member.active ? "active" : "inactive"),
											)}
										</span>
									))}
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onOpenMerge(candidate)}
								className="w-full shrink-0 md:w-auto"
							>
								<GitMerge className="size-4" />
								Merge
							</Button>
						</div>
					))}
				</div>
			</div>
		</GlassCard>
	);
}
