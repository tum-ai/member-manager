import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import { Download, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import GlassCard from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { useToast } from "../../contexts/ToastContext";
import { useEngagementCertificateRequests } from "../../hooks/useEngagementCertificateRequests";
import { useMemberData } from "../../hooks/useMemberData";
import {
	DEPARTMENTS,
	ENGAGEMENT_SPECIAL_ROLES,
	WEEKLY_HOURS_OPTIONS,
} from "../../lib/constants";
import { downloadPdfBlob, formatGermanDate } from "../../lib/pdfUtils";
import {
	type EngagementFormSchema,
	type EngagementSchema,
	engagementFormSchema,
} from "../../lib/schemas";
import ToolPageShell from "../tools/ToolPageShell";
import { generateEngagementCertificatePdf } from "./generators/engagementCertificatePdf";

interface Props {
	user: User;
}

// Radix SelectItem cannot use an empty string value, so we map the
// "unselected" form state ("") to/from this sentinel.
const NONE_VALUE = "__none__";

function createDefaultEngagement(): EngagementSchema {
	return {
		id: crypto.randomUUID(),
		startDate: "",
		endDate: "",
		isStillActive: false,
		weeklyHours: "",
		department: "",
		isTeamLead: false,
		specialRole: "",
		tasksDescription: "",
	};
}

export default function EngagementCertificatePage({
	user,
}: Props): JSX.Element {
	const { member, isLoading, error: fetchError } = useMemberData(user.id);
	const { requests, submitRequestAsync, isSubmitting } =
		useEngagementCertificateRequests(user.id);
	const { showToast } = useToast();
	const [isGenerating, setIsGenerating] = useState(false);

	const form = useForm<EngagementFormSchema>({
		resolver: zodResolver(engagementFormSchema),
		defaultValues: {
			engagements: [createDefaultEngagement()],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "engagements",
	});

	const latestRequest = requests[0];
	const approvedRequest = requests.find(
		(request) => request.status === "approved",
	);
	const isRequestPending = latestRequest?.status === "pending";

	const handleSubmitForApproval = async (
		data: EngagementFormSchema,
	): Promise<void> => {
		if (!member) {
			showToast("Member data not available", "error");
			return;
		}

		try {
			await submitRequestAsync(data);
			showToast("Certificate request submitted for admin approval.", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(
				`Error submitting certificate request: ${errorMessage}`,
				"error",
			);
		} finally {
			form.reset({
				engagements: data.engagements,
			});
		}
	};

	const handleDownloadApproved = async (): Promise<void> => {
		if (!member || !approvedRequest || isGenerating) {
			return;
		}

		setIsGenerating(true);
		try {
			const pdfBlob = await generateEngagementCertificatePdf(
				member,
				approvedRequest.engagements,
			);
			const safeGivenName = member.given_name.replace(/[^a-zA-Z0-9-_]/g, "-");
			const safeSurname = member.surname.replace(/[^a-zA-Z0-9-_]/g, "-");
			const fullName = `${safeGivenName}-${safeSurname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Engagement_Certificate_${fullName}.pdf`);
			showToast("Approved certificate downloaded successfully!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error generating certificate: ${errorMessage}`, "error");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleAddEngagement = (): void => {
		if (fields.length >= 5) {
			showToast("Maximum 5 engagements allowed", "warning");
			return;
		}
		append(createDefaultEngagement());
	};

	const handleRemoveEngagement = (index: number): void => {
		if (fields.length <= 1) {
			showToast("At least one engagement is required", "warning");
			return;
		}
		remove(index);
	};

	if (isLoading) {
		return <EngagementCertificateSkeleton />;
	}

	if (fetchError) {
		return (
			<div className="p-6">
				<p className="text-destructive">
					Error loading member data: {fetchError.message}
				</p>
			</div>
		);
	}

	if (!member) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">No member data found.</p>
			</div>
		);
	}

	if (
		(member.member_status || (member.active ? "active" : "inactive")) !==
		"active"
	) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">
					This feature is only available for active members.
				</p>
			</div>
		);
	}

	const birthDate = formatGermanDate(member.date_of_birth);

	return (
		<ToolPageShell
			title="Engagement Certificate"
			description="Submit engagement details for admin review."
		>
			<GlassCard className="mb-6">
				<div className="p-6">
					<p className="mb-4">
						Submit your engagement details for an admin review before the final
						certificate is released. Please enter{" "}
						<strong>accurate information</strong> for each period you were
						actively involved.
					</p>

					<p className="mb-4 text-sm text-muted-foreground">
						<strong>Important:</strong> Everything you enter below will be
						reviewed by an admin and appear in the final certificate only after
						approval. Make sure names, dates, and responsibilities are correct
						and complete.
					</p>

					{latestRequest && (
						<div className="mb-4 rounded-md bg-brand/10 p-4">
							<p className="mb-0.5 text-sm font-semibold">
								Current request status: {latestRequest.status}
							</p>
							{latestRequest.review_note && (
								<p className="text-sm text-muted-foreground">
									Admin note: {latestRequest.review_note}
								</p>
							)}
						</div>
					)}

					<div className="mb-4 rounded-md bg-muted p-4">
						<p className="text-sm">
							This is to confirm that{" "}
							<strong>
								{member.salutation} {member.given_name} {member.surname}
							</strong>
							{birthDate === "Not provided" ? "" : ", born on "}
							{birthDate === "Not provided" ? null : (
								<strong>{birthDate}</strong>
							)}
							, has voluntarily engaged with <strong>TUM.ai</strong>.
						</p>
					</div>
				</div>
			</GlassCard>

			<form onSubmit={form.handleSubmit(handleSubmitForApproval)}>
				{fields.map((field, index) => {
					const errors = form.formState.errors.engagements?.[index];
					return (
						<GlassCard key={field.id} className="mb-6">
							<div className="p-6">
								<div className="mb-4 flex items-center justify-between">
									<h2 className="text-lg font-medium">
										Engagement #{index + 1}
									</h2>
									{fields.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="text-destructive hover:text-destructive"
											onClick={() => handleRemoveEngagement(index)}
											aria-label={`Remove engagement ${index + 1}`}
										>
											<Trash2 className="size-4" />
										</Button>
									)}
								</div>

								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div className="flex flex-col gap-1.5">
										<Label htmlFor={`startDate-${index}`}>Start Date</Label>
										<Input
											id={`startDate-${index}`}
											type="date"
											aria-invalid={!!errors?.startDate}
											required
											{...form.register(`engagements.${index}.startDate`)}
										/>
										{errors?.startDate?.message && (
											<p className="text-xs text-destructive">
												{errors.startDate.message}
											</p>
										)}
									</div>

									<div className="flex items-center gap-2">
										<Checkbox
											id={`isStillActive-${index}`}
											checked={form.watch(`engagements.${index}.isStillActive`)}
											onCheckedChange={(value) =>
												form.setValue(
													`engagements.${index}.isStillActive`,
													value === true,
												)
											}
										/>
										<Label
											htmlFor={`isStillActive-${index}`}
											className="font-normal"
										>
											I am still active in this role
										</Label>
									</div>

									{!form.watch(`engagements.${index}.isStillActive`) && (
										<div className="flex flex-col gap-1.5">
											<Label htmlFor={`endDate-${index}`}>End Date</Label>
											<Input
												id={`endDate-${index}`}
												type="date"
												aria-invalid={!!errors?.endDate}
												required
												{...form.register(`engagements.${index}.endDate`)}
											/>
											{errors?.endDate?.message && (
												<p className="text-xs text-destructive">
													{errors.endDate.message}
												</p>
											)}
										</div>
									)}

									<div className="flex flex-col gap-1.5">
										<Label htmlFor={`weeklyHours-${index}`}>Weekly Hours</Label>
										<Controller
											control={form.control}
											name={`engagements.${index}.weeklyHours`}
											render={({ field: selectField }) => (
												<Select
													value={selectField.value || NONE_VALUE}
													onValueChange={(value) =>
														selectField.onChange(
															value === NONE_VALUE ? "" : value,
														)
													}
												>
													<SelectTrigger
														id={`weeklyHours-${index}`}
														className="w-full"
														aria-label="Weekly Hours"
														aria-invalid={!!errors?.weeklyHours}
													>
														<SelectValue placeholder="Select" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={NONE_VALUE}>Select</SelectItem>
														{WEEKLY_HOURS_OPTIONS.map((hours) => (
															<SelectItem key={hours} value={hours.toString()}>
																{hours} hours
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
										{errors?.weeklyHours?.message && (
											<p className="text-xs text-destructive">
												{errors.weeklyHours.message}
											</p>
										)}
									</div>

									<div className="flex flex-col gap-1.5">
										<Label htmlFor={`department-${index}`}>Department</Label>
										<Controller
											control={form.control}
											name={`engagements.${index}.department`}
											render={({ field: selectField }) => (
												<Select
													value={selectField.value || NONE_VALUE}
													onValueChange={(value) =>
														selectField.onChange(
															value === NONE_VALUE ? "" : value,
														)
													}
												>
													<SelectTrigger
														id={`department-${index}`}
														className="w-full"
														aria-label="Department"
														aria-invalid={!!errors?.department}
													>
														<SelectValue placeholder="Select" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={NONE_VALUE}>Select</SelectItem>
														{DEPARTMENTS.map((dept) => (
															<SelectItem key={dept} value={dept}>
																{dept}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
										{errors?.department?.message && (
											<p className="text-xs text-destructive">
												{errors.department.message}
											</p>
										)}
									</div>

									<div className="flex flex-col gap-1.5">
										<Label htmlFor={`specialRole-${index}`}>Special role</Label>
										<Controller
											control={form.control}
											name={`engagements.${index}.specialRole`}
											render={({ field: selectField }) => (
												<Select
													value={selectField.value || NONE_VALUE}
													onValueChange={(value) =>
														selectField.onChange(
															value === NONE_VALUE ? "" : value,
														)
													}
												>
													<SelectTrigger
														id={`specialRole-${index}`}
														className="w-full"
														aria-label="Special role"
														aria-invalid={!!errors?.specialRole}
													>
														<SelectValue placeholder="None" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value={NONE_VALUE}>None</SelectItem>
														{ENGAGEMENT_SPECIAL_ROLES.map((role) => (
															<SelectItem key={role} value={role}>
																{role}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											)}
										/>
										<p className="text-xs text-muted-foreground">
											{errors?.specialRole?.message ||
												"Optional board or executive responsibility."}
										</p>
									</div>

									<div className="flex items-center gap-2">
										<Checkbox
											id={`isTeamLead-${index}`}
											checked={form.watch(`engagements.${index}.isTeamLead`)}
											onCheckedChange={(value) =>
												form.setValue(
													`engagements.${index}.isTeamLead`,
													value === true,
												)
											}
										/>
										<Label
											htmlFor={`isTeamLead-${index}`}
											className="font-normal"
										>
											I was a team lead
										</Label>
									</div>

									<div className="flex flex-col gap-1.5 md:col-span-2">
										<Label htmlFor={`tasksDescription-${index}`}>
											Tasks / Responsibilities
										</Label>
										<Textarea
											id={`tasksDescription-${index}`}
											rows={4}
											placeholder="List each responsibility on a new line"
											aria-invalid={!!errors?.tasksDescription}
											required
											{...form.register(
												`engagements.${index}.tasksDescription`,
											)}
										/>
										{errors?.tasksDescription?.message ? (
											<p className="text-xs text-destructive">
												{errors.tasksDescription.message}
											</p>
										) : (
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>Enter each task on a new line</span>
												<span>
													{
														(
															form.watch(
																`engagements.${index}.tasksDescription`,
															) || ""
														).length
													}
													/1000 chars
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						</GlassCard>
					);
				})}

				<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
					<Button
						type="button"
						variant="outline"
						className="w-full sm:w-auto"
						onClick={handleAddEngagement}
						disabled={fields.length >= 5}
					>
						<Plus className="size-4" />
						Add Another Engagement
					</Button>

					<div className="hidden flex-1 sm:block" />

					<Button
						type="submit"
						size="lg"
						className="w-full sm:w-auto"
						disabled={isSubmitting || isRequestPending}
					>
						{isSubmitting ? (
							<Spinner className="size-5" />
						) : (
							<Download className="size-4" />
						)}
						{isSubmitting
							? "Submitting..."
							: isRequestPending
								? "Awaiting Admin Review"
								: "Submit for Approval"}
					</Button>
				</div>

				{approvedRequest && (
					<div className="mb-6 flex justify-end">
						<Button
							type="button"
							variant="outline"
							className="w-full sm:w-auto"
							onClick={handleDownloadApproved}
							disabled={isGenerating}
						>
							{isGenerating ? (
								<Spinner className="size-[18px]" />
							) : (
								<Download className="size-4" />
							)}
							{isGenerating
								? "Generating approved certificate..."
								: "Download Approved Certificate"}
						</Button>
					</div>
				)}

				<p className="mt-2 text-xs text-muted-foreground">
					* Dates, weekly hours, department, and responsibilities are required.
					Special role is optional.
				</p>
			</form>
		</ToolPageShell>
	);
}

function EngagementCertificateSkeleton() {
	return (
		<ToolPageShell
			title="Engagement Certificate"
			description="Submit engagement details for admin review."
		>
			<SkeletonRegion label="Loading engagement certificate">
				<GlassCard className="mb-6">
					<div className="space-y-3 p-6">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-11/12" />
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="mt-2 h-16 w-full rounded-md" />
					</div>
				</GlassCard>
				<GlassCard className="mb-6">
					<div className="p-6">
						<Skeleton className="mb-4 h-6 w-40" />
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{Array.from({ length: 4 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								<div key={i} className="space-y-2">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-9 w-full rounded-md" />
								</div>
							))}
						</div>
					</div>
				</GlassCard>
				<Skeleton className="h-10 w-44 rounded-md" />
			</SkeletonRegion>
		</ToolPageShell>
	);
}
