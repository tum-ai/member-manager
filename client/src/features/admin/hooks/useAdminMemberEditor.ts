import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import type { AdminMember } from "@/features/admin/adminUtils";
import type { useAdminData } from "@/hooks/useAdminData";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { BOARD_MEMBER_ROLE } from "@/lib/constants";
import { isLinkedinProfileUrl } from "@/lib/linkedin";
import {
	getOperationalDepartment,
	isExecutiveMemberRole,
	requiresDepartmentForMemberRole,
	resolveDepartmentForMemberRole,
} from "@/lib/memberMetadata";
import { getResearchProjectSelectValue } from "@/lib/researchProjects";

function getResolvedStatus(member: AdminMember): string {
	return member.member_status || (member.active ? "active" : "inactive");
}

interface UseAdminMemberEditorParams {
	updateMemberAsync: ReturnType<typeof useAdminData>["updateMemberAsync"];
	isSavingMember: boolean;
}

export function useAdminMemberEditor({
	updateMemberAsync,
	isSavingMember,
}: UseAdminMemberEditorParams) {
	const { showToast } = useToast();
	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();

	const [memberBeingEdited, setMemberBeingEdited] =
		useState<AdminMember | null>(null);
	const [editDepartment, setEditDepartment] = useState("");
	const [editRole, setEditRole] = useState("Member");
	const [editBatch, setEditBatch] = useState("");
	const [editResearchProjectId, setEditResearchProjectId] = useState("");
	const [editIsBoardMember, setEditIsBoardMember] = useState(false);
	const [editStatus, setEditStatus] = useState("active");
	const [editAccessRole, setEditAccessRole] = useState<"user" | "admin">(
		"user",
	);
	const [editLinkedinUrl, setEditLinkedinUrl] = useState("");
	const [editLocation, setEditLocation] = useState("");

	function openMemberEditor(member: AdminMember) {
		setMemberBeingEdited(member);
		setEditRole(member.member_role || "Member");
		setEditDepartment(
			isExecutiveMemberRole(member.member_role)
				? ""
				: getOperationalDepartment(member.department) || "",
		);
		setEditBatch(member.batch || "");
		setEditResearchProjectId(member.research_project_id || "");
		setEditIsBoardMember(member.board_role === BOARD_MEMBER_ROLE);
		setEditStatus(getResolvedStatus(member));
		setEditAccessRole(member.access_role === "admin" ? "admin" : "user");
		setEditLinkedinUrl(member.linkedin_profile_url || "");
		setEditLocation(member.public_location || "");
	}

	function closeMemberEditor() {
		setMemberBeingEdited(null);
	}

	const editRoleNeedsDepartment = requiresDepartmentForMemberRole(editRole);
	const editRoleIsExecutive = isExecutiveMemberRole(editRole);
	const editEffectiveDepartment = resolveDepartmentForMemberRole(
		editRole,
		editDepartment || null,
	);
	const existingEditRole = memberBeingEdited?.member_role || "Member";
	const existingEditDepartment = memberBeingEdited
		? resolveDepartmentForMemberRole(
				existingEditRole,
				getOperationalDepartment(memberBeingEdited.department) || null,
			)
		: null;
	const isPreservingMissingRequiredDepartment = Boolean(
		memberBeingEdited &&
			editRoleNeedsDepartment &&
			!editDepartment &&
			editRole === existingEditRole &&
			!existingEditDepartment,
	);
	const isMissingRequiredDepartment =
		editRoleNeedsDepartment &&
		!editDepartment &&
		!isPreservingMissingRequiredDepartment;
	const editIsResearchDepartment = editEffectiveDepartment === "Research";
	const researchProjectOptions = (researchProjects ?? []).filter((project) => {
		const status = project.status?.trim().toLowerCase();
		return !status || ["ongoing", "active", "in progress"].includes(status);
	});
	const editResearchProjectSelectValue = getResearchProjectSelectValue(
		editResearchProjectId,
		researchProjectOptions,
	);
	const isEditLinkedinUrlInvalid = Boolean(
		editLinkedinUrl.trim() && !isLinkedinProfileUrl(editLinkedinUrl),
	);
	const isMemberSaveDisabled =
		isSavingMember || isMissingRequiredDepartment || isEditLinkedinUrlInvalid;

	async function saveMemberChanges() {
		if (!memberBeingEdited || isMissingRequiredDepartment) return;

		const effectiveDepartment = resolveDepartmentForMemberRole(
			editRole,
			editDepartment || null,
		);

		try {
			await updateMemberAsync({
				userId: memberBeingEdited.user_id,
				department: effectiveDepartment,
				member_role: editRole,
				board_role: editIsBoardMember ? BOARD_MEMBER_ROLE : null,
				member_status: editStatus,
				access_role: editAccessRole,
				batch: editBatch || null,
				research_project_id:
					effectiveDepartment === "Research"
						? editResearchProjectId || null
						: null,
				linkedin_profile_url: editLinkedinUrl.trim() || null,
				public_location: editLocation.trim() || null,
			});
			showToast("Member updated successfully", "success");
			setMemberBeingEdited(null);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to update member: ${errorMessage}`, "error");
		}
	}

	return {
		memberBeingEdited,
		openMemberEditor,
		closeMemberEditor,
		isSavingMember,
		isLoadingResearchProjects,
		editDepartment,
		setEditDepartment,
		editRole,
		setEditRole,
		editBatch,
		setEditBatch,
		editResearchProjectId,
		setEditResearchProjectId,
		editIsBoardMember,
		setEditIsBoardMember,
		editStatus,
		setEditStatus,
		editAccessRole,
		setEditAccessRole,
		editLinkedinUrl,
		setEditLinkedinUrl,
		editLocation,
		setEditLocation,
		editRoleIsExecutive,
		isMissingRequiredDepartment,
		isPreservingMissingRequiredDepartment,
		editIsResearchDepartment,
		researchProjectOptions,
		editResearchProjectSelectValue,
		isEditLinkedinUrlInvalid,
		isMemberSaveDisabled,
		saveMemberChanges,
	};
}
