import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ClaimFieldInput,
	type ClaimStatus,
	type ClaimType,
	type EducationClaim,
	type EmploymentClaim,
	type ProfilePatch,
	type ProjectClaim,
	profilePatchSchema,
	type SkillClaim,
	type TagClaim,
} from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { useToast } from "@/contexts/ToastContext";
import type {
	ClaimDialogState,
	ClaimRowModel,
} from "@/features/expertise/types";
import { useExpertiseData } from "./useExpertiseData";

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

function baseRow(
	type: ClaimType,
	claim:
		| EmploymentClaim
		| EducationClaim
		| SkillClaim
		| ProjectClaim
		| TagClaim,
	fields: Pick<ClaimRowModel, "title" | "subtitle" | "entityTags" | "prefill">,
): ClaimRowModel {
	return {
		key: `${type}:${claim.id}`,
		type,
		id: claim.id,
		status: claim.status,
		confidence: claim.confidence,
		source: claim.source,
		...fields,
	};
}

/** Owns route resolution, forms, mutation handlers, and profile view models. */
export function useExpertiseProfilePage({
	user,
	userId: userIdProp,
}: {
	user: User;
	userId?: string;
}) {
	const { userId: paramUserId } = useParams();
	const userId = userIdProp ?? paramUserId ?? user.id;
	const embedded = userIdProp !== undefined;
	const { showToast } = useToast();
	const data = useExpertiseData(userId);
	const [dialog, setDialog] = useState<ClaimDialogState | null>(null);
	const aboutForm = useForm<ProfilePatch>({
		resolver: zodResolver(profilePatchSchema),
		defaultValues: { headline: "", summary: "" },
	});

	const profile = data.profileQuery.data;
	useEffect(() => {
		aboutForm.reset({
			headline: profile?.person?.headline ?? "",
			summary: profile?.person?.summary ?? "",
		});
	}, [aboutForm, profile?.person?.headline, profile?.person?.summary]);
	useEffect(() => {
		if (!data.tagsQuery.error) return;
		showToast(
			data.tagsQuery.error instanceof Error
				? data.tagsQuery.error.message
				: "Could not load capabilities",
			"error",
		);
	}, [data.tagsQuery.error, showToast]);

	const rows = useMemo(() => {
		if (!profile) return [];
		return [
			...profile.employment.map((claim) =>
				baseRow("employment", claim, {
					title: claim.organization?.name ?? claim.raw_value ?? "Organization",
					subtitle: [
						claim.title,
						yearRange(claim.start_year, claim.end_year, claim.is_current),
					]
						.filter(Boolean)
						.join(" · "),
					entityTags: claim.organization?.tags,
					prefill: {
						organization_name: claim.organization?.name ?? claim.raw_value,
						title: claim.title,
						start_year: claim.start_year,
						end_year: claim.end_year,
						is_current: claim.is_current,
					},
				}),
			),
			...profile.education.map((claim) =>
				baseRow("education", claim, {
					title: claim.school?.name ?? claim.raw_value ?? "School",
					subtitle: [
						claim.degree,
						claim.field,
						yearRange(claim.start_year, claim.end_year),
					]
						.filter(Boolean)
						.join(" · "),
					entityTags: claim.school?.groups,
					prefill: {
						school_name: claim.school?.name ?? claim.raw_value,
						degree: claim.degree,
						field: claim.field,
						start_year: claim.start_year,
						end_year: claim.end_year,
					},
				}),
			),
			...profile.skills.map((claim) =>
				baseRow("skill", claim, {
					title: claim.skill?.name ?? claim.raw_value ?? "Skill",
					subtitle: claim.proficiency,
					entityTags: claim.skill?.category
						? [claim.skill.category]
						: undefined,
					prefill: {
						skill_name: claim.skill?.name ?? claim.raw_value,
						proficiency: claim.proficiency,
					},
				}),
			),
			...profile.projects.map((claim) =>
				baseRow("project", claim, {
					title: claim.project?.name ?? claim.raw_value ?? "Project",
					subtitle: [claim.role, claim.project?.description]
						.filter(Boolean)
						.join(" · "),
					prefill: {
						project_name: claim.project?.name ?? claim.raw_value,
						role: claim.role,
						url: claim.project?.url,
						description: claim.project?.description,
					},
				}),
			),
			...profile.tags.map((claim) =>
				baseRow("tag", claim, {
					title: claim.vocabulary?.label ?? claim.tag,
					subtitle: claim.vocabulary?.category,
					prefill: { tag: claim.tag },
				}),
			),
		];
	}, [profile]);

	const saveAbout = aboutForm.handleSubmit(async (values) => {
		try {
			await data.saveProfile.mutateAsync({
				headline: values.headline?.trim() || null,
				summary: values.summary?.trim() || null,
			});
			showToast("Profile saved.", "success");
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to save",
				"error",
			);
		}
	});

	const toggleOptOut = async (next: boolean) => {
		try {
			await data.setOptOut.mutateAsync(next);
			showToast(
				next ? "Your expertise profile is now hidden." : "Opted back in.",
				"success",
			);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to update visibility",
				"error",
			);
		}
	};

	const setClaimStatus = async (row: ClaimRowModel, status: ClaimStatus) => {
		try {
			await data.patchClaim.mutateAsync({
				type: row.type,
				id: row.id,
				body: { status },
			});
			showToast(
				status === "confirmed" ? "Claim confirmed." : "Claim rejected.",
				"success",
			);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to update claim",
				"error",
			);
		}
	};

	const deleteClaim = async (row: ClaimRowModel) => {
		try {
			await data.deleteClaim.mutateAsync({ type: row.type, id: row.id });
			showToast("Claim deleted.", "success");
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to delete claim",
				"error",
			);
		}
	};

	const saveClaim = async (body: ClaimFieldInput) => {
		if (!dialog) return;
		try {
			if (dialog.id) {
				await data.patchClaim.mutateAsync({
					type: dialog.type,
					id: dialog.id,
					body,
				});
			} else {
				await data.addClaim.mutateAsync({ type: dialog.type, body });
			}
			showToast(dialog.id ? "Claim updated." : "Claim added.", "success");
			setDialog(null);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to save claim",
				"error",
			);
		}
	};

	const claimBusy = (row: ClaimRowModel) => {
		const patch = data.patchClaim.variables;
		const remove = data.deleteClaim.variables;
		return (
			(data.patchClaim.isPending &&
				patch?.type === row.type &&
				patch.id === row.id) ||
			(data.deleteClaim.isPending &&
				remove?.type === row.type &&
				remove.id === row.id)
		);
	};

	return {
		userId,
		embedded,
		profile,
		isLoading: data.profileQuery.isLoading,
		error: data.profileQuery.error,
		refetch: data.profileQuery.refetch,
		tags: data.tagsQuery.data ?? [],
		rows,
		pendingRows: rows.filter((row) => row.status === "pending"),
		rowsByType: (type: ClaimType) =>
			rows.filter((row) => row.type === type && row.status !== "pending"),
		aboutForm,
		saveAbout,
		isSavingAbout: data.saveProfile.isPending,
		toggleOptOut,
		isTogglingOptOut: data.setOptOut.isPending,
		dialog,
		openAdd: (type: ClaimType) => setDialog({ type }),
		openEdit: (row: ClaimRowModel) =>
			setDialog({ type: row.type, id: row.id, prefill: row.prefill }),
		closeDialog: () => setDialog(null),
		saveClaim,
		isSavingClaim: data.addClaim.isPending || data.patchClaim.isPending,
		claimBusy,
		confirmClaim: (row: ClaimRowModel) => setClaimStatus(row, "confirmed"),
		rejectClaim: (row: ClaimRowModel) => setClaimStatus(row, "rejected"),
		deleteClaim,
	};
}

export type ExpertiseProfilePageViewModel = ReturnType<
	typeof useExpertiseProfilePage
>;
