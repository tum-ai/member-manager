import { Search, ShieldCheck, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/ToastContext";
import type { AdminMember } from "@/features/admin/adminUtils";

interface EducationalCourseAdministratorsCardProps {
	members: AdminMember[];
	isUpdating: boolean;
	onSetAdministrator: (input: {
		userId: string;
		enabled: boolean;
	}) => Promise<unknown>;
}

function memberName(member: AdminMember): string {
	return `${member.given_name} ${member.surname}`.trim() || "Unnamed member";
}

function isActive(member: AdminMember): boolean {
	return member.member_status
		? member.member_status === "active"
		: member.active;
}

export function EducationalCourseAdministratorsCard({
	members,
	isUpdating,
	onSetAdministrator,
}: EducationalCourseAdministratorsCardProps) {
	const { showToast } = useToast();
	const [search, setSearch] = useState("");
	const administrators = useMemo(
		() =>
			members
				.filter((member) => member.educational_course_role === "administrator")
				.sort((left, right) =>
					memberName(left).localeCompare(memberName(right)),
				),
		[members],
	);
	const candidates = useMemo(() => {
		const normalized = search.trim().toLowerCase();
		if (!normalized) return [];
		return members
			.filter(
				(member) =>
					isActive(member) &&
					member.educational_course_role !== "administrator" &&
					`${memberName(member)} ${member.email}`
						.toLowerCase()
						.includes(normalized),
			)
			.slice(0, 8);
	}, [members, search]);

	async function setAdministrator(userId: string, enabled: boolean) {
		try {
			await onSetAdministrator({ userId, enabled });
			showToast(
				enabled
					? "Educational course administrator added."
					: "Educational course administrator removed.",
				"success",
			);
			if (enabled) setSearch("");
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Could not update access.",
				"error",
			);
		}
	}

	return (
		<GlassCard className="mb-6">
			<div className="space-y-5 p-6">
				<div className="flex items-start gap-3">
					<div className="rounded-lg bg-brand/10 p-2 text-brand dark:bg-brand/15">
						<ShieldCheck className="size-5" aria-hidden="true" />
					</div>
					<div>
						<h2 className="text-lg font-semibold">
							Educational Course Administrators
						</h2>
						<p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
							Appoint active members who may plan course periods, manage the
							task force, and review applications. This access is independent of
							global administrator access.
						</p>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-2">
						<label
							htmlFor="education-admin-search"
							className="text-sm font-medium"
						>
							Add administrator
						</label>
						<div className="relative">
							<Search
								className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden="true"
							/>
							<Input
								id="education-admin-search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search active members"
								className="pl-9"
							/>
						</div>
						{search.trim() && (
							<div className="max-h-56 overflow-y-auto rounded-lg border bg-card p-1">
								{candidates.length === 0 ? (
									<p className="px-3 py-4 text-center text-sm text-muted-foreground">
										No eligible members found.
									</p>
								) : (
									candidates.map((member) => (
										<div
											key={member.user_id}
											className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/60"
										>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">
													{memberName(member)}
												</p>
												<p className="truncate text-xs text-muted-foreground">
													{member.email}
												</p>
											</div>
											<Button
												type="button"
												size="sm"
												disabled={isUpdating}
												onClick={() => setAdministrator(member.user_id, true)}
											>
												<UserPlus className="size-4" aria-hidden="true" />
												Add
											</Button>
										</div>
									))
								)}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Current administrators</p>
						<div className="space-y-2 rounded-lg bg-muted/35 p-3 dark:bg-muted/20">
							{administrators.length === 0 ? (
								<p className="py-3 text-center text-sm text-muted-foreground">
									No educational course administrators assigned.
								</p>
							) : (
								administrators.map((member) => (
									<div
										key={member.user_id}
										className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 shadow-sm"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{memberName(member)}
											</p>
											<div className="mt-1 flex flex-wrap gap-1.5">
												<Badge variant="accent">Administrator</Badge>
												{!isActive(member) && (
													<Badge variant="neutral">Inactive</Badge>
												)}
											</div>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											disabled={isUpdating}
											onClick={() => setAdministrator(member.user_id, false)}
											aria-label={`Remove ${memberName(member)} as educational course administrator`}
										>
											<X className="size-4" aria-hidden="true" />
										</Button>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
		</GlassCard>
	);
}
