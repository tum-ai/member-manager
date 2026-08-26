import {
	Briefcase,
	Code2,
	FolderKanban,
	GraduationCap,
	Inbox,
	Plus,
	RefreshCw,
	Save,
	Sparkles,
	Tags,
} from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ClaimDialog } from "@/features/expertise/ClaimDialog";
import { ClaimRow } from "@/features/expertise/ClaimRow";
import type { ExpertiseProfilePageViewModel } from "@/features/expertise/hooks/useExpertiseProfilePage";
import { ProfileHero } from "@/features/expertise/ProfileHero";
import type { ClaimRowModel, ClaimType } from "@/features/expertise/types";

const CLAIM_SECTIONS: {
	type: ClaimType;
	title: string;
	icon: typeof Sparkles;
}[] = [
	{ type: "employment", title: "Experience", icon: Briefcase },
	{ type: "education", title: "Education", icon: GraduationCap },
	{ type: "skill", title: "Skills", icon: Code2 },
	{ type: "project", title: "Projects", icon: FolderKanban },
	{ type: "tag", title: "Capabilities", icon: Tags },
];

/** Complete, prop-driven Expertise profile surface. */
export function ExpertiseProfileSection({
	profilePage,
}: {
	profilePage: ExpertiseProfilePageViewModel;
}): JSX.Element {
	if (profilePage.isLoading) return <ExpertiseSkeleton />;
	if (profilePage.error || !profilePage.profile) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Could not load this expertise profile</AlertTitle>
				<AlertDescription className="mt-2 flex flex-col items-start gap-3">
					<span>
						{profilePage.error instanceof Error
							? profilePage.error.message
							: "The profile response was invalid."}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => profilePage.refetch()}
					>
						<RefreshCw className="size-4" /> Try again
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	const profile = profilePage.profile;
	const member = profile.member;
	const fullName =
		[member?.given_name, member?.surname].filter(Boolean).join(" ") || "Member";
	const initials =
		`${member?.given_name?.charAt(0) ?? ""}${member?.surname?.charAt(0) ?? ""}`.toUpperCase() ||
		"?";
	if (profile.opted_out && !profile.editable) {
		return (
			<GlassCard variant="elevated" className="mx-auto max-w-2xl">
				<CardContent className="p-8 text-center">
					<Sparkles className="mx-auto mb-3 size-8 text-muted-foreground" />
					<h1 className="text-lg font-semibold">{fullName}</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						This member has opted out of the expertise directory.
					</p>
				</CardContent>
			</GlassCard>
		);
	}

	const renderRow = (row: ClaimRowModel) => (
		<ClaimRow
			key={row.key}
			title={row.title}
			subtitle={row.subtitle}
			entityTags={row.entityTags}
			status={row.status}
			confidence={row.confidence}
			source={row.source}
			editable={profile.editable}
			busy={profilePage.claimBusy(row)}
			onConfirm={() => profilePage.confirmClaim(row)}
			onReject={() => profilePage.rejectClaim(row)}
			onEdit={() => profilePage.openEdit(row)}
			onDelete={() => profilePage.deleteClaim(row)}
		/>
	);

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
				editable={profile.editable}
				optedOut={profile.person?.opted_out ?? false}
				onToggleOptOut={profilePage.toggleOptOut}
				busyOptOut={profilePage.isTogglingOptOut}
			/>
			{profile.editable ? (
				<GlassCard variant="elevated">
					<CardContent className="p-4 sm:p-6">
						<SectionHeading
							icon={Sparkles}
							title="About"
							description="A short headline and summary for your expertise profile."
						/>
						<form className="grid gap-4" onSubmit={profilePage.saveAbout}>
							<div className="grid gap-1.5">
								<Label htmlFor="beacon-headline">Headline</Label>
								<Textarea
									id="beacon-headline"
									{...profilePage.aboutForm.register("headline")}
									rows={2}
									placeholder="Senior iOS engineer · shipped App Store products"
								/>
								{profilePage.aboutForm.formState.errors.headline?.message ? (
									<p className="text-sm text-destructive">
										{profilePage.aboutForm.formState.errors.headline.message}
									</p>
								) : null}
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="beacon-summary">Summary</Label>
								<Textarea
									id="beacon-summary"
									{...profilePage.aboutForm.register("summary")}
									rows={5}
									placeholder="What you work on, what you are great at, and what you would love to help with."
								/>
								{profilePage.aboutForm.formState.errors.summary?.message ? (
									<p className="text-sm text-destructive">
										{profilePage.aboutForm.formState.errors.summary.message}
									</p>
								) : null}
							</div>
							<div>
								<Button type="submit" disabled={profilePage.isSavingAbout}>
									{profilePage.isSavingAbout ? (
										<Spinner className="size-4" />
									) : (
										<Save className="size-4" />
									)}{" "}
									Save profile
								</Button>
							</div>
						</form>
					</CardContent>
				</GlassCard>
			) : profile.person?.summary ? (
				<GlassCard variant="elevated">
					<CardContent className="p-4 sm:p-6">
						<SectionHeading icon={Sparkles} title="About" />
						<p className="whitespace-pre-wrap text-sm">
							{profile.person.summary}
						</p>
					</CardContent>
				</GlassCard>
			) : null}

			{profile.editable && profilePage.pendingRows.length ? (
				<GlassCard variant="elevated" className="bg-brand/5">
					<CardContent className="p-4 sm:p-6">
						<SectionHeading
							icon={Inbox}
							title={`Unverified claims (${profilePage.pendingRows.length})`}
							description="These searchable enrichment results need your review. Confirm what is right or reject what is not."
						/>
						<div className="space-y-2">
							{profilePage.pendingRows.map(renderRow)}
						</div>
					</CardContent>
				</GlassCard>
			) : null}

			{CLAIM_SECTIONS.map((section) => (
				<ClaimSection
					key={section.type}
					icon={section.icon}
					title={section.title}
					editable={profile.editable}
					onAdd={() => profilePage.openAdd(section.type)}
					empty={profilePage.rowsByType(section.type).length === 0}
				>
					{profilePage.rowsByType(section.type).map(renderRow)}
				</ClaimSection>
			))}

			{profilePage.dialog ? (
				<ClaimDialog
					type={profilePage.dialog.type}
					open
					onOpenChange={(open) => {
						if (!open) profilePage.closeDialog();
					}}
					prefill={profilePage.dialog.prefill}
					tagsVocab={profilePage.tags}
					busy={profilePage.isSavingClaim}
					onSave={profilePage.saveClaim}
				/>
			) : null}
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
			{description ? (
				<p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}

function ClaimSection({
	icon: Icon,
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
			<CardContent className="p-4 sm:p-6">
				<div className="mb-4 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2.5">
						<Icon className="size-5 text-brand" />
						<h2 className="text-base font-semibold">{title}</h2>
					</div>
					{editable ? (
						<Button type="button" variant="outline" size="sm" onClick={onAdd}>
							<Plus className="size-4" /> Add
						</Button>
					) : null}
				</div>
				{empty ? (
					<p className="text-sm text-muted-foreground">
						{editable ? "Nothing here yet." : "Nothing to show."}
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
			<div className="space-y-6">
				<Skeleton className="h-40 w-full rounded-2xl" />
				{["about", "experience", "skills"].map((section) => (
					<Skeleton key={section} className="h-32 w-full rounded-2xl" />
				))}
			</div>
		</SkeletonRegion>
	);
}
