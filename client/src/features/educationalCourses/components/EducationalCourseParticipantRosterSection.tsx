import type {
	EducationalCourseParticipant,
	EducationalCourseParticipantCandidate,
} from "@member-manager/shared";
import { Search, UserPlus, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";

interface EducationalCourseParticipantRosterSectionProps {
	participants: EducationalCourseParticipant[];
	eligibleMembers: EducationalCourseParticipantCandidate[];
	search: string;
	isLoading: boolean;
	isUpdating: boolean;
	onSearchChange: (value: string) => void;
	onSetParticipant: (userId: string, enabled: boolean) => void;
}

function displayName(person: { givenName?: string; surname?: string }): string {
	return `${person.givenName ?? ""} ${person.surname ?? ""}`.trim();
}

export function EducationalCourseParticipantRosterSection({
	participants,
	eligibleMembers,
	search,
	isLoading,
	isUpdating,
	onSearchChange,
	onSetParticipant,
}: EducationalCourseParticipantRosterSectionProps) {
	return (
		<GlassCard>
			<div className="space-y-4 p-5 sm:p-6">
				<div className="flex items-start gap-3">
					<div className="rounded-lg bg-brand/10 p-2 text-brand dark:bg-brand/15">
						<Users className="size-5" aria-hidden="true" />
					</div>
					<div>
						<h2 className="font-semibold">Education task force</h2>
						<p className="text-sm text-muted-foreground">
							Add active members who may view periods and apply.
						</p>
					</div>
				</div>

				<div className="relative">
					<Search
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						aria-label="Search members to add to the education task force"
						placeholder="Search active members"
						value={search}
						onChange={(event) => onSearchChange(event.target.value)}
						className="pl-9"
					/>
				</div>

				{search.trim() && (
					<div className="max-h-52 overflow-y-auto rounded-lg border bg-card p-1">
						{eligibleMembers.length === 0 ? (
							<p className="px-3 py-4 text-center text-sm text-muted-foreground">
								No eligible members found.
							</p>
						) : (
							eligibleMembers.map((member) => (
								<div
									key={member.userId}
									className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/60"
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											{displayName(member)}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{member.email}
										</p>
									</div>
									<Button
										type="button"
										size="sm"
										disabled={isUpdating}
										onClick={() => onSetParticipant(member.userId, true)}
									>
										<UserPlus className="size-4" aria-hidden="true" />
										Add
									</Button>
								</div>
							))
						)}
					</div>
				)}

				<div>
					<p className="mb-2 text-sm font-medium">Current participants</p>
					{isLoading ? (
						<p className="text-sm text-muted-foreground">
							Loading participants...
						</p>
					) : participants.length === 0 ? (
						<p className="rounded-lg bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
							No participants assigned.
						</p>
					) : (
						<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{participants.map((participant) => (
								<li
									key={participant.userId}
									className="flex items-center justify-between gap-2 rounded-lg bg-muted/35 px-3 py-2 dark:bg-muted/20"
								>
									<div className="min-w-0">
										<span className="block truncate text-sm font-medium">
											{displayName(participant)}
										</span>
										{!participant.active && (
											<Badge variant="neutral" className="mt-1">
												Inactive
											</Badge>
										)}
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										disabled={isUpdating}
										onClick={() => onSetParticipant(participant.userId, false)}
										aria-label={`Remove ${displayName(participant)} from the education task force`}
									>
										<X className="size-4" aria-hidden="true" />
									</Button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</GlassCard>
	);
}
