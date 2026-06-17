import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { NONE_VALUE } from "@/features/admin/adminDatabaseViewTypes";
import type { useAdminMemberEditor } from "@/features/admin/hooks/useAdminMemberEditor";
import { BATCH_OPTIONS, DEPARTMENTS, MEMBER_ROLES } from "@/lib/constants";
import {
	getMemberStatusLabel,
	isExecutiveMemberRole,
	MEMBER_STATUSES,
} from "@/lib/memberMetadata";
import { cn } from "@/lib/utils";

type AdminMemberEditorDialogProps = ReturnType<typeof useAdminMemberEditor>;

export function AdminMemberEditorDialog({
	memberBeingEdited,
	closeMemberEditor,
	isSavingMember,
	isLoadingResearchProjects,
	editDepartment,
	setEditDepartment,
	editRole,
	setEditRole,
	editBatch,
	setEditBatch,
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
}: AdminMemberEditorDialogProps) {
	return (
		<Dialog
			open={Boolean(memberBeingEdited)}
			onOpenChange={(open) => {
				if (!open && !isSavingMember) {
					closeMemberEditor();
				}
			}}
		>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Edit member</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4 pt-1">
					<p className="text-muted-foreground">
						{memberBeingEdited
							? `Update ${memberBeingEdited.given_name} ${memberBeingEdited.surname}.`
							: ""}
					</p>
					{/* ── LinkedIn & Professional ── */}
					<p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
						<Link2 className="size-4 text-brand" />
						LinkedIn & Professional
					</p>
					<div className="grid gap-1.5">
						<Label htmlFor="edit-linkedin">LinkedIn Profile URL</Label>
						<Input
							id="edit-linkedin"
							placeholder="https://linkedin.com/in/your-profile"
							value={editLinkedinUrl}
							onChange={(e) => setEditLinkedinUrl(e.target.value)}
							aria-invalid={isEditLinkedinUrlInvalid}
						/>
						{isEditLinkedinUrlInvalid && (
							<p className="text-xs text-destructive">
								Use a LinkedIn profile URL like https://linkedin.com/in/name.
							</p>
						)}
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="edit-location">Public location</Label>
						<Input
							id="edit-location"
							placeholder="Munich, Germany"
							value={editLocation}
							onChange={(e) => setEditLocation(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Shown on the member profile; separate from address fields.
						</p>
					</div>
					<Separator />
					{/* ── Org fields ── */}
					<div className="grid gap-1.5">
						<Label htmlFor="edit-batch">Batch</Label>
						<Select
							value={editBatch || NONE_VALUE}
							onValueChange={(value) =>
								setEditBatch(value === NONE_VALUE ? "" : value)
							}
						>
							<SelectTrigger
								id="edit-batch"
								aria-label="Batch"
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								{BATCH_OPTIONS.map((batch) => (
									<SelectItem key={batch} value={batch}>
										{batch}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Member's TUM.ai joining semester.
						</p>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="edit-department">Department</Label>
						<Select
							value={editDepartment || NONE_VALUE}
							onValueChange={(value) => {
								const nextValue = value === NONE_VALUE ? "" : value;
								setEditDepartment(nextValue);
								if (nextValue !== "Research") {
									setEditResearchProjectId("");
								}
							}}
							disabled={editRoleIsExecutive}
						>
							<SelectTrigger
								id="edit-department"
								aria-label="Department"
								aria-invalid={isMissingRequiredDepartment}
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								{DEPARTMENTS.map((department) => (
									<SelectItem key={department} value={department}>
										{department}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p
							className={cn(
								"text-xs",
								isMissingRequiredDepartment
									? "text-destructive"
									: "text-muted-foreground",
							)}
						>
							{editRoleIsExecutive
								? "President and Vice-President are not assigned to a department."
								: isMissingRequiredDepartment
									? "Select a department for Member and Team Lead roles."
									: isPreservingMissingRequiredDepartment
										? "No department assigned yet; keep the role unchanged to save this profile update."
										: "Operational home. Board membership is assigned separately."}
						</p>
					</div>
					{editIsResearchDepartment && (
						<div className="grid gap-1.5">
							<Label htmlFor="edit-research-project">Research project</Label>
							<Select
								value={editResearchProjectSelectValue || NONE_VALUE}
								onValueChange={(value) =>
									setEditResearchProjectId(value === NONE_VALUE ? "" : value)
								}
								disabled={isLoadingResearchProjects}
							>
								<SelectTrigger
									id="edit-research-project"
									aria-label="Research project"
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE_VALUE}>
										No project selected
									</SelectItem>
									{researchProjectOptions.map((project) => (
										<SelectItem key={project.id} value={project.id}>
											{project.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Research project assignment for org chart grouping.
							</p>
						</div>
					)}
					<div className="grid gap-1.5">
						<Label htmlFor="edit-role">Role</Label>
						<Select
							value={editRole}
							onValueChange={(nextRole) => {
								setEditRole(nextRole);
								if (isExecutiveMemberRole(nextRole)) {
									setEditDepartment("");
									setEditResearchProjectId("");
								}
							}}
						>
							<SelectTrigger
								id="edit-role"
								aria-label="Role"
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MEMBER_ROLES.map((role) => (
									<SelectItem key={role} value={role}>
										{role}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="edit-board-member"
								checked={editIsBoardMember}
								onCheckedChange={(checked) =>
									setEditIsBoardMember(checked === true)
								}
							/>
							<Label htmlFor="edit-board-member">Board member</Label>
						</div>
						<p className="text-xs text-muted-foreground">
							Additional responsibility. It does not change the department or
							the internal team lead/member role.
						</p>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="edit-status">Status</Label>
						<Select value={editStatus} onValueChange={setEditStatus}>
							<SelectTrigger
								id="edit-status"
								aria-label="Status"
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MEMBER_STATUSES.map((status) => (
									<SelectItem key={status} value={status}>
										{getMemberStatusLabel(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="edit-access">Access</Label>
						<Select
							value={editAccessRole}
							onValueChange={(value) =>
								setEditAccessRole(value as "user" | "admin")
							}
						>
							<SelectTrigger
								id="edit-access"
								aria-label="Access"
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="user">User</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="ghost"
						onClick={closeMemberEditor}
						disabled={isSavingMember}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={saveMemberChanges}
						disabled={isMemberSaveDisabled}
					>
						{isSavingMember ? "Saving..." : "Save member changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
