import { Trash2 } from "lucide-react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	DEPARTMENTS,
	ENGAGEMENT_SPECIAL_ROLES,
	WEEKLY_HOURS_OPTIONS,
} from "@/lib/constants";
import type { EngagementFormSchema } from "@/lib/schemas";

// Radix SelectItem cannot use an empty string value, so we map the
// "unselected" form state ("") to/from this sentinel.
const NONE_VALUE = "__none__";

interface Props {
	form: UseFormReturn<EngagementFormSchema>;
	index: number;
	canRemove: boolean;
	onRemove: (index: number) => void;
}

export function EngagementCard({
	form,
	index,
	canRemove,
	onRemove,
}: Props): JSX.Element {
	const errors = form.formState.errors.engagements?.[index];

	return (
		<GlassCard className="mb-6">
			<div className="p-6">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-medium">Engagement #{index + 1}</h2>
					{canRemove && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-destructive hover:text-destructive"
							onClick={() => onRemove(index)}
							aria-label={`Remove engagement ${index + 1}`}
						>
							<Trash2 className="size-4" />
						</Button>
					)}
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="flex min-w-0 flex-col gap-1.5">
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
						<Label htmlFor={`isStillActive-${index}`} className="font-normal">
							I am still active in this role
						</Label>
					</div>

					{!form.watch(`engagements.${index}.isStillActive`) && (
						<div className="flex min-w-0 flex-col gap-1.5">
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

					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor={`weeklyHours-${index}`}>Weekly Hours</Label>
						<Controller
							control={form.control}
							name={`engagements.${index}.weeklyHours`}
							render={({ field: selectField }) => (
								<Select
									value={selectField.value || NONE_VALUE}
									onValueChange={(value) =>
										selectField.onChange(value === NONE_VALUE ? "" : value)
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

					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor={`department-${index}`}>Department</Label>
						<Controller
							control={form.control}
							name={`engagements.${index}.department`}
							render={({ field: selectField }) => (
								<Select
									value={selectField.value || NONE_VALUE}
									onValueChange={(value) =>
										selectField.onChange(value === NONE_VALUE ? "" : value)
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

					<div className="flex min-w-0 flex-col gap-1.5">
						<Label htmlFor={`specialRole-${index}`}>Special role</Label>
						<Controller
							control={form.control}
							name={`engagements.${index}.specialRole`}
							render={({ field: selectField }) => (
								<Select
									value={selectField.value || NONE_VALUE}
									onValueChange={(value) =>
										selectField.onChange(value === NONE_VALUE ? "" : value)
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
								form.setValue(`engagements.${index}.isTeamLead`, value === true)
							}
						/>
						<Label htmlFor={`isTeamLead-${index}`} className="font-normal">
							I was a team lead
						</Label>
					</div>

					<div className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
						<Label htmlFor={`tasksDescription-${index}`}>
							Tasks / Responsibilities
						</Label>
						<Textarea
							id={`tasksDescription-${index}`}
							rows={4}
							placeholder="List each responsibility on a new line"
							aria-invalid={!!errors?.tasksDescription}
							required
							{...form.register(`engagements.${index}.tasksDescription`)}
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
										(form.watch(`engagements.${index}.tasksDescription`) || "")
											.length
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
}
