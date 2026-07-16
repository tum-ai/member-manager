import {
	PARTNER_JOB_TYPES,
	type PartnerJobInput,
} from "@member-manager/shared";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PARTNER_JOB_TYPE_LABELS } from "@/features/partnerManagement/partnerManagementUtils";

interface PartnerJobFormProps {
	form: UseFormReturn<PartnerJobInput>;
	onSubmit: () => void;
	onCancel: () => void;
	isSaving: boolean;
	submitLabel: string;
}

export function PartnerJobForm({
	form,
	onSubmit,
	onCancel,
	isSaving,
	submitLabel,
}: PartnerJobFormProps) {
	const {
		register,
		control,
		formState: { errors },
	} = form;

	return (
		<>
			<form
				id="partner-job-form"
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
				onSubmit={onSubmit}
				noValidate
			>
				<Field
					label="Job title"
					htmlFor="partner-job-title"
					required
					error={errors.title?.message}
				>
					<Input
						id="partner-job-title"
						aria-invalid={!!errors.title}
						aria-describedby={
							errors.title ? "partner-job-title-error" : undefined
						}
						{...register("title")}
					/>
				</Field>

				<Field
					label="Job type"
					htmlFor="partner-job-type"
					required
					error={errors.jobType?.message}
				>
					<Controller
						control={control}
						name="jobType"
						render={({ field }) => (
							<Select value={field.value} onValueChange={field.onChange}>
								<SelectTrigger
									id="partner-job-type"
									className="w-full"
									aria-invalid={!!errors.jobType}
									aria-describedby={
										errors.jobType ? "partner-job-type-error" : undefined
									}
								>
									<SelectValue placeholder="Select a job type" />
								</SelectTrigger>
								<SelectContent>
									{PARTNER_JOB_TYPES.map((value) => (
										<SelectItem key={value} value={value}>
											{PARTNER_JOB_TYPE_LABELS[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				</Field>

				<Field
					label="Location"
					htmlFor="partner-job-location"
					required
					error={errors.location?.message}
				>
					<Input
						id="partner-job-location"
						aria-invalid={!!errors.location}
						aria-describedby={
							errors.location ? "partner-job-location-error" : undefined
						}
						{...register("location")}
					/>
				</Field>

				<Field
					label="Application URL"
					htmlFor="partner-job-url"
					error={errors.externalUrl?.message}
				>
					<Input
						id="partner-job-url"
						type="url"
						placeholder="https://example.com/jobs"
						aria-invalid={!!errors.externalUrl}
						aria-describedby={
							errors.externalUrl ? "partner-job-url-error" : undefined
						}
						{...register("externalUrl")}
					/>
				</Field>

				<Field
					className="sm:col-span-2"
					label="Description"
					htmlFor="partner-job-description"
					required
					error={errors.description?.message}
				>
					<Textarea
						id="partner-job-description"
						rows={6}
						aria-invalid={!!errors.description}
						aria-describedby={
							errors.description ? "partner-job-description-error" : undefined
						}
						{...register("description")}
					/>
				</Field>

				<Field
					label="Button label"
					htmlFor="partner-job-cta"
					required
					error={errors.callToAction?.message}
				>
					<Input
						id="partner-job-cta"
						aria-invalid={!!errors.callToAction}
						aria-describedby={
							errors.callToAction ? "partner-job-cta-error" : undefined
						}
						{...register("callToAction")}
					/>
				</Field>

				<Field
					label="Logo URL"
					htmlFor="partner-job-logo"
					error={errors.logoUrl?.message}
				>
					<Input
						id="partner-job-logo"
						type="url"
						placeholder="https://example.com/logo.png"
						aria-invalid={!!errors.logoUrl}
						aria-describedby={
							errors.logoUrl ? "partner-job-logo-error" : undefined
						}
						{...register("logoUrl")}
					/>
				</Field>

				<Field
					label="Contact name"
					htmlFor="partner-job-contact-name"
					required
					error={errors.contactName?.message}
				>
					<Input
						id="partner-job-contact-name"
						aria-invalid={!!errors.contactName}
						aria-describedby={
							errors.contactName ? "partner-job-contact-name-error" : undefined
						}
						{...register("contactName")}
					/>
				</Field>

				<Field
					label="Contact email"
					htmlFor="partner-job-contact-email"
					required
					error={errors.contactEmail?.message}
				>
					<Input
						id="partner-job-contact-email"
						type="email"
						aria-invalid={!!errors.contactEmail}
						aria-describedby={
							errors.contactEmail
								? "partner-job-contact-email-error"
								: undefined
						}
						{...register("contactEmail")}
					/>
				</Field>

				<Field
					className="sm:col-span-2"
					label="Contact role"
					htmlFor="partner-job-contact-role"
					error={errors.contactRole?.message}
				>
					<Input
						id="partner-job-contact-role"
						aria-invalid={!!errors.contactRole}
						aria-describedby={
							errors.contactRole ? "partner-job-contact-role-error" : undefined
						}
						{...register("contactRole")}
					/>
				</Field>
			</form>

			<DialogFooter>
				<Button variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button
					type="submit"
					form="partner-job-form"
					className="bg-[#9A64D9] text-white hover:bg-[#523573]"
					disabled={isSaving}
				>
					{isSaving ? "Saving..." : submitLabel}
				</Button>
			</DialogFooter>
		</>
	);
}
