import { GraduationCap } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { EducationFields } from "@/features/profile/EducationFields";
import {
	fromSelectValue,
	NONE_VALUE,
	toSelectValue,
} from "@/features/profile/profileUtils";
import { BATCH_OPTIONS, DEPARTMENTS, MEMBER_ROLES } from "@/lib/constants";
import { resolveDepartmentForMemberRole } from "@/lib/memberMetadata";
import type { MemberSchema } from "@/lib/schemas";
import type { ResearchProject } from "@/types";
import { SectionHeading } from "./SectionHeading";

interface TumaiProfileSectionProps {
	memberForm: UseFormReturn<MemberSchema>;
	isAdmin: boolean;
	currentRole: string;
	currentDepartment: string;
	isResearchDepartmentSelected: boolean;
	isLoadingResearchProjects: boolean;
	researchProjectOptions: ResearchProject[];
	researchProjectSelectValue: string;
	ids: {
		batch: string;
		department: string;
		role: string;
		researchProject: string;
	};
}

export function TumaiProfileSection({
	memberForm,
	isAdmin,
	currentRole,
	currentDepartment,
	isResearchDepartmentSelected,
	isLoadingResearchProjects,
	researchProjectOptions,
	researchProjectSelectValue,
	ids,
}: TumaiProfileSectionProps): JSX.Element {
	const errors = memberForm.formState.errors;

	return (
		<GlassCard id="tumai" variant="elevated" className="scroll-mt-20">
			<CardContent className="p-6">
				<SectionHeading
					icon={GraduationCap}
					title="TUM.ai profile"
					description="Your batch, department, role, and studies."
				/>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field
						label="Batch"
						htmlFor={ids.batch}
						error={errors.batch?.message}
					>
						<Select
							value={toSelectValue(memberForm.watch("batch") || "")}
							onValueChange={(value) =>
								memberForm.setValue("batch", fromSelectValue(value), {
									shouldDirty: true,
								})
							}
						>
							<SelectTrigger
								id={ids.batch}
								className="w-full"
								aria-label="Batch"
								aria-invalid={!!errors.batch}
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
					</Field>
					<Field label="Department" htmlFor={ids.department}>
						{isAdmin ? (
							<Select
								value={toSelectValue(currentDepartment)}
								onValueChange={(rawValue) => {
									const value = fromSelectValue(rawValue);
									memberForm.setValue("department", value, {
										shouldDirty: true,
									});
									if (value !== "Research") {
										memberForm.setValue("research_project_id", "", {
											shouldDirty: true,
										});
									}
								}}
							>
								<SelectTrigger
									id={ids.department}
									className="w-full"
									aria-label="Department"
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
						) : (
							<>
								<Input
									id={ids.department}
									value={currentDepartment || "Not set"}
									disabled
									readOnly
								/>
								<p className="text-xs text-muted-foreground">
									Departments are assigned by admins. Request a change below.
								</p>
							</>
						)}
					</Field>

					<Field label="Role in TUM.ai" htmlFor={ids.role}>
						{isAdmin ? (
							<>
								<Select
									value={currentRole}
									onValueChange={(value) => {
										memberForm.setValue("member_role", value, {
											shouldDirty: true,
										});
										const nextDepartment = resolveDepartmentForMemberRole(
											value,
											currentDepartment,
										);
										if (nextDepartment !== currentDepartment) {
											memberForm.setValue("department", nextDepartment || "", {
												shouldDirty: true,
											});
										}
										if (nextDepartment !== "Research") {
											memberForm.setValue("research_project_id", "", {
												shouldDirty: true,
											});
										}
									}}
								>
									<SelectTrigger
										id={ids.role}
										className="w-full"
										aria-label="Role in TUM.ai"
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
								<p className="text-xs text-muted-foreground">
									Admins manage role assignments.
								</p>
							</>
						) : (
							<>
								<Input id={ids.role} value={currentRole} disabled readOnly />
								<p className="text-xs text-muted-foreground">
									Roles are assigned by admins
								</p>
							</>
						)}
					</Field>
					{isResearchDepartmentSelected && (
						<Field
							label="Research project"
							htmlFor={ids.researchProject}
							description="Pick the research project you are part of."
						>
							<Select
								value={toSelectValue(researchProjectSelectValue)}
								onValueChange={(value) =>
									memberForm.setValue(
										"research_project_id",
										fromSelectValue(value),
										{ shouldDirty: true },
									)
								}
								disabled={isLoadingResearchProjects}
							>
								<SelectTrigger
									id={ids.researchProject}
									className="w-full"
									aria-label="Research project"
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
						</Field>
					)}
					<EducationFields
						degreeValue={memberForm.watch("degree")}
						schoolValue={memberForm.watch("school")}
						onChange={(values) => {
							memberForm.setValue("degree", values.degree, {
								shouldDirty: true,
							});
							memberForm.setValue("school", values.school, {
								shouldDirty: true,
							});
						}}
					/>
				</div>
			</CardContent>
		</GlassCard>
	);
}
