import type { User } from "@supabase/supabase-js";
import {
	Briefcase,
	Code2,
	FolderKanban,
	GraduationCap,
	Inbox,
	Plus,
	Save,
	Sparkles,
	Tags,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import GlassCard from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "../../contexts/ToastContext";
import { useExpertise, useExpertiseTags } from "../../hooks/useExpertise";
import "./beacon.css";
import { ClaimDialog } from "./ClaimDialog";
import { ClaimRow } from "./ClaimRow";
import { ProfileHero } from "./ProfileHero";
import type {
	ClaimType,
	EducationClaim,
	EmploymentClaim,
	ProjectClaim,
	SkillClaim,
	TagClaim,
} from "./types";

interface Props {
	user: User;
	// When set (e.g. rendered inside the chat profile drawer), overrides the
	// route param / current user as the profile to show.
	userId?: string;
}

function yearRange(
	start: number | null,
	end: number | null,
	isCurrent?: boolean,
): string {
	if (!start && !end) return "";
	const right = isCurrent ? "present" : end ? String(end) : "";
	if (start && right) return `${start} – ${right}`;
	return String(start ?? right);
}

export default function ExpertiseProfilePage({
	user,
	userId: userIdProp,
}: Props): JSX.Element {
	const { userId: paramUserId } = useParams();
	const userId = userIdProp ?? paramUserId ?? user.id;
	const { showToast } = useToast();

	const {
		profile,
		isLoading,
		saveProfileAsync,
		isSavingProfile,
		setOptOutAsync,
		isTogglingOptOut,
		addClaimAsync,
		isAddingClaim,
		patchClaimAsync,
		deleteClaimAsync,
	} = useExpertise(userId);
	const { data: tagsVocab } = useExpertiseTags();

	const [headline, setHeadline] = useState("");
	const [summary, setSummary] = useState("");
	const [dialog, setDialog] = useState<{
		type: ClaimType;
		prefill?: Record<string, unknown> | null;
		id?: string;
	} | null>(null);

	useEffect(() => {
		if (profile?.person) {
			setHeadline(profile.person.headline ?? "");
			setSummary(profile.person.summary ?? "");
		}
	}, [profile?.person]);

	if (isLoading || !profile) {
		return <ExpertiseSkeleton />;
	}

	const editable = profile.editable;
	const member = profile.member;
	const fullName =
		[member?.given_name, member?.surname].filter(Boolean).join(" ") || "Member";
	const initials =
		`${member?.given_name?.charAt(0) ?? ""}${member?.surname?.charAt(0) ?? ""}`.toUpperCase() ||
		"?";

	if (profile.opted_out && !editable) {
		return (
			<div className="mx-auto max-w-2xl">
				<GlassCard variant="elevated">
					<CardContent className="p-8 text-center">
						<Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />
						<h1 className="text-lg font-semibold">{fullName}</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							This member has opted out of the expertise directory.
						</p>
					</CardContent>
				</GlassCard>
			</div>
		);
	}

	const handleSaveProfile = async () => {
		try {
			await saveProfileAsync({
				headline: headline.trim() || null,
				summary: summary.trim() || null,
			});
			showToast("Profile saved.", "success");
		} catch (e) {
			showToast(e instanceof Error ? e.message : "Failed to save", "error");
		}
	};

	const handleOptOut = async (next: boolean) => {
		try {
			await setOptOutAsync(next);
			showToast(
				next
					? "Opted out — your profile is hidden and search entries removed."
					: "Opted back in.",
				"success",
			);
		} catch (e) {
			showToast(e instanceof Error ? e.message : "Failed", "error");
		}
	};

	const runClaim = async (fn: () => Promise<unknown>, ok: string) => {
		try {
			await fn();
			showToast(ok, "success");
		} catch (e) {
			showToast(e instanceof Error ? e.message : "Failed", "error");
		}
	};

	const onSaveDialog = async (body: Record<string, unknown>) => {
		if (!dialog) return;
		try {
			if (dialog.id) {
				await patchClaimAsync({ type: dialog.type, id: dialog.id, body });
				showToast("Updated.", "success");
			} else {
				await addClaimAsync({ type: dialog.type, body });
				showToast("Added.", "success");
			}
			setDialog(null);
		} catch (e) {
			showToast(e instanceof Error ? e.message : "Failed to save", "error");
		}
	};

	// Build a ClaimRow for any claim type, wiring confirm/reject/edit/delete.
	const renderClaim = (
		type: ClaimType,
		id: string,
		props: {
			title: string;
			subtitle?: string | null;
			entityTags?: string[];
			status: (typeof profile.employment)[number]["status"];
			confidence: number;
			source: (typeof profile.employment)[number]["source"];
			prefill: Record<string, unknown>;
		},
	) => (
		<ClaimRow
			key={id}
			title={props.title}
			subtitle={props.subtitle}
			entityTags={props.entityTags}
			status={props.status}
			confidence={props.confidence}
			source={props.source}
			editable={editable}
			onConfirm={() =>
				runClaim(
					() => patchClaimAsync({ type, id, body: { status: "confirmed" } }),
					"Confirmed.",
				)
			}
			onReject={() =>
				runClaim(
					() => patchClaimAsync({ type, id, body: { status: "rejected" } }),
					"Rejected.",
				)
			}
			onEdit={() => setDialog({ type, id, prefill: props.prefill })}
			onDelete={() =>
				runClaim(() => deleteClaimAsync({ type, id }), "Deleted.")
			}
		/>
	);

	const employmentRow = (c: EmploymentClaim) =>
		renderClaim("employment", c.id, {
			title: c.organization?.name ?? c.raw_value ?? "Organization",
			subtitle: [c.title, yearRange(c.start_year, c.end_year, c.is_current)]
				.filter(Boolean)
				.join(" · "),
			entityTags: c.organization?.tags,
			status: c.status,
			confidence: c.confidence,
			source: c.source,
			prefill: {
				organization_name: c.organization?.name ?? c.raw_value,
				title: c.title,
				start_year: c.start_year,
				end_year: c.end_year,
				is_current: c.is_current,
			},
		});

	const educationRow = (c: EducationClaim) =>
		renderClaim("education", c.id, {
			title: c.school?.name ?? c.raw_value ?? "School",
			subtitle: [c.degree, c.field, yearRange(c.start_year, c.end_year)]
				.filter(Boolean)
				.join(" · "),
			entityTags: c.school?.groups,
			status: c.status,
			confidence: c.confidence,
			source: c.source,
			prefill: {
				school_name: c.school?.name ?? c.raw_value,
				degree: c.degree,
				field: c.field,
				start_year: c.start_year,
				end_year: c.end_year,
			},
		});

	const skillRow = (c: SkillClaim) =>
		renderClaim("skill", c.id, {
			title: c.skill?.name ?? c.raw_value ?? "Skill",
			subtitle: c.proficiency,
			entityTags: c.skill?.category ? [c.skill.category] : undefined,
			status: c.status,
			confidence: c.confidence,
			source: c.source,
			prefill: {
				skill_name: c.skill?.name ?? c.raw_value,
				proficiency: c.proficiency,
			},
		});

	const projectRow = (c: ProjectClaim) =>
		renderClaim("project", c.id, {
			title: c.project?.name ?? c.raw_value ?? "Project",
			subtitle: [c.role, c.project?.description].filter(Boolean).join(" · "),
			status: c.status,
			confidence: c.confidence,
			source: c.source,
			prefill: {
				project_name: c.project?.name ?? c.raw_value,
				role: c.role,
				url: c.project?.url,
				description: c.project?.description,
			},
		});

	const tagRow = (c: TagClaim) =>
		renderClaim("tag", c.id, {
			title: c.vocabulary?.label ?? c.tag,
			subtitle: c.vocabulary?.category,
			status: c.status,
			confidence: c.confidence,
			source: c.source,
			prefill: { tag: c.tag },
		});

	// Pending items across all types feed the review queue.
	const pending = [
		...profile.employment
			.filter((c) => c.status === "pending")
			.map(employmentRow),
		...profile.education
			.filter((c) => c.status === "pending")
			.map(educationRow),
		...profile.skills.filter((c) => c.status === "pending").map(skillRow),
		...profile.projects.filter((c) => c.status === "pending").map(projectRow),
		...profile.tags.filter((c) => c.status === "pending").map(tagRow),
	];

	const nonPending = <T extends { status: string }>(arr: T[]) =>
		arr.filter((c) => c.status !== "pending");

	return (
		<div className="space-y-6">
			<ProfileHero
				name={fullName}
				initials={initials}
				role={member?.member_role}
				dept={member?.department}
				headline={profile.person?.headline}
				confirmed={profile.counts.confirmed}
				pending={profile.counts.pending}
				editable={editable}
				optedOut={profile.person?.opted_out ?? false}
				onToggleOptOut={handleOptOut}
				busyOptOut={isTogglingOptOut}
			/>

			{/* Main */}
			<div className="flex flex-col gap-6">
				{editable && (
					<GlassCard variant="elevated">
						<CardContent className="p-6">
							<SectionHeading
								icon={Sparkles}
								title="About"
								description="A short headline and summary for your expertise profile."
							/>
							<div className="grid gap-4">
								<div className="grid gap-1.5">
									<Label htmlFor="beacon-headline">Headline</Label>
									<Textarea
										id="beacon-headline"
										value={headline}
										onChange={(e) => setHeadline(e.target.value)}
										rows={2}
										placeholder="Senior iOS engineer · shipped 3 App Store apps · ML on-device"
									/>
								</div>
								<div className="grid gap-1.5">
									<Label htmlFor="beacon-summary">Summary</Label>
									<Textarea
										id="beacon-summary"
										value={summary}
										onChange={(e) => setSummary(e.target.value)}
										rows={5}
										placeholder="What you work on, what you're great at, what you'd love to help with."
									/>
								</div>
								<div>
									<Button
										type="button"
										onClick={handleSaveProfile}
										disabled={isSavingProfile}
									>
										{isSavingProfile ? (
											<Spinner className="size-4" />
										) : (
											<Save className="size-4" />
										)}
										Save
									</Button>
								</div>
							</div>
						</CardContent>
					</GlassCard>
				)}

				{!editable && profile.person?.summary && (
					<GlassCard variant="elevated">
						<CardContent className="p-6">
							<SectionHeading icon={Sparkles} title="About" />
							<p className="whitespace-pre-wrap text-sm">
								{profile.person.summary}
							</p>
						</CardContent>
					</GlassCard>
				)}

				{/* Review queue */}
				{editable && pending.length > 0 && (
					<GlassCard variant="elevated" className="border-amber-500/40">
						<CardContent className="p-6">
							<SectionHeading
								icon={Inbox}
								title={`Review queue (${pending.length})`}
								description="We found these from enrichment. Confirm what's right, reject what isn't."
							/>
							<div className="space-y-2">{pending}</div>
						</CardContent>
					</GlassCard>
				)}

				<ClaimSection
					icon={Briefcase}
					title="Experience"
					editable={editable}
					onAdd={() => setDialog({ type: "employment" })}
					empty={profile.employment.length === 0}
				>
					{nonPending(profile.employment).map(employmentRow)}
				</ClaimSection>

				<ClaimSection
					icon={GraduationCap}
					title="Education"
					editable={editable}
					onAdd={() => setDialog({ type: "education" })}
					empty={profile.education.length === 0}
				>
					{nonPending(profile.education).map(educationRow)}
				</ClaimSection>

				<ClaimSection
					icon={Code2}
					title="Skills"
					editable={editable}
					onAdd={() => setDialog({ type: "skill" })}
					empty={profile.skills.length === 0}
				>
					{nonPending(profile.skills).map(skillRow)}
				</ClaimSection>

				<ClaimSection
					icon={FolderKanban}
					title="Projects"
					editable={editable}
					onAdd={() => setDialog({ type: "project" })}
					empty={profile.projects.length === 0}
				>
					{nonPending(profile.projects).map(projectRow)}
				</ClaimSection>

				<ClaimSection
					icon={Tags}
					title="Capabilities"
					editable={editable}
					onAdd={() => setDialog({ type: "tag" })}
					empty={profile.tags.length === 0}
				>
					{nonPending(profile.tags).map(tagRow)}
				</ClaimSection>
			</div>

			{dialog && (
				<ClaimDialog
					type={dialog.type}
					open={true}
					onOpenChange={(o) => !o && setDialog(null)}
					prefill={dialog.prefill}
					tagsVocab={tagsVocab}
					busy={isAddingClaim}
					onSave={onSaveDialog}
				/>
			)}
		</div>
	);
}

function SectionHeading({
	icon: Icon,
	title,
	description,
}: {
	icon: typeof Sparkles;
	title: string;
	description?: string;
}): JSX.Element {
	return (
		<div className="mb-5">
			<div className="flex items-center gap-2.5">
				<Icon className="size-5 text-brand" />
				<h2 className="text-base font-semibold">{title}</h2>
			</div>
			{description && (
				<p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
			)}
		</div>
	);
}

function ClaimSection({
	icon,
	title,
	editable,
	onAdd,
	empty,
	children,
}: {
	icon: typeof Sparkles;
	title: string;
	editable: boolean;
	onAdd: () => void;
	empty: boolean;
	children: ReactNode;
}): JSX.Element {
	return (
		<GlassCard variant="elevated">
			<CardContent className="p-6">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						{(() => {
							const Icon = icon;
							return <Icon className="size-5 text-brand" />;
						})()}
						<h2 className="text-base font-semibold">{title}</h2>
					</div>
					{editable && (
						<Button type="button" variant="outline" size="sm" onClick={onAdd}>
							<Plus className="size-4" />
							Add
						</Button>
					)}
				</div>
				{empty ? (
					<p className="text-sm text-muted-foreground">
						{editable
							? "Nothing here yet. Add an entry or run enrichment."
							: "Nothing to show."}
					</p>
				) : (
					<div className="space-y-2">{children}</div>
				)}
			</CardContent>
		</GlassCard>
	);
}

function ExpertiseSkeleton(): JSX.Element {
	return (
		<SkeletonRegion label="Loading expertise profile">
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
				<aside className="lg:col-span-4">
					<GlassCard variant="elevated">
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<Skeleton className="size-16 shrink-0 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-6 w-40" />
									<Skeleton className="h-4 w-28" />
								</div>
							</div>
							<Skeleton className="mt-4 h-7 w-40 rounded-full" />
						</CardContent>
					</GlassCard>
				</aside>
				<div className="flex flex-col gap-6 lg:col-span-8">
					{Array.from({ length: 3 }).map((_, i) => (
						<GlassCard
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							key={i}
							variant="elevated"
						>
							<CardContent className="space-y-3 p-6">
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-16 w-full rounded-lg" />
								<Skeleton className="h-16 w-full rounded-lg" />
							</CardContent>
						</GlassCard>
					))}
				</div>
			</div>
		</SkeletonRegion>
	);
}
