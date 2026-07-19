import type {
	JobPostingFormInput,
	JobPostingInput,
} from "@member-manager/shared";
import { JOB_TYPES } from "@member-manager/shared";
import { Save } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { adminJobTypeLabels } from "@/features/admin/adminRequests";

interface AdminJobEditorDialogProps {
	mode: "create" | "edit" | null;
	form: UseFormReturn<JobPostingFormInput, unknown, JobPostingInput>;
	isSaving: boolean;
	onClose: () => void;
	onSubmit: () => void;
}

export function AdminJobEditorDialog({
	mode,
	form,
	isSaving,
	onClose,
	onSubmit,
}: AdminJobEditorDialogProps) {
	const {
		register,
		control,
		formState: { errors },
	} = form;

	return (
		<Dialog
			open={mode !== null}
			onOpenChange={(open) => {
				if (!open && !isSaving) onClose();
			}}
		>
			<DialogContent
				className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
				onEscapeKeyDown={(event) => {
					if (isSaving) event.preventDefault();
				}}
				onPointerDownOutside={(event) => {
					if (isSaving) event.preventDefault();
				}}
			>
				<form id="admin-job-form" onSubmit={onSubmit} noValidate>
					<DialogHeader>
						<DialogTitle>
							{mode === "edit" ? "Edit job posting" : "Create job posting"}
						</DialogTitle>
						<DialogDescription className="sr-only">
							Enter the job posting details.
						</DialogDescription>
					</DialogHeader>

					<div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
						<Field
							label="Job title"
							htmlFor="admin-job-title"
							required
							error={errors.title?.message}
						>
							<Input
								id="admin-job-title"
								required
								aria-invalid={!!errors.title}
								aria-describedby={
									errors.title ? "admin-job-title-error" : undefined
								}
								{...register("title")}
							/>
						</Field>
						<Field
							label="Organization"
							htmlFor="admin-job-organization"
							required
							error={errors.organization_name?.message}
						>
							<Input
								id="admin-job-organization"
								required
								aria-invalid={!!errors.organization_name}
								aria-describedby={
									errors.organization_name
										? "admin-job-organization-error"
										: undefined
								}
								{...register("organization_name")}
							/>
						</Field>
						<Field
							label="Job type"
							htmlFor="admin-job-type"
							required
							error={errors.job_type?.message}
						>
							<Controller
								control={control}
								name="job_type"
								render={({ field }) => (
									<Select
										value={field.value ?? undefined}
										onValueChange={field.onChange}
									>
										<SelectTrigger
											id="admin-job-type"
											className="w-full"
											aria-required="true"
											aria-invalid={!!errors.job_type}
											aria-describedby={
												errors.job_type ? "admin-job-type-error" : undefined
											}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{JOB_TYPES.map((type) => (
												<SelectItem key={type} value={type}>
													{adminJobTypeLabels[type]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</Field>
						<Field
							label="Location"
							htmlFor="admin-job-location"
							required
							error={errors.location?.message}
						>
							<Input
								id="admin-job-location"
								required
								aria-invalid={!!errors.location}
								aria-describedby={
									errors.location ? "admin-job-location-error" : undefined
								}
								{...register("location")}
							/>
						</Field>
						<Field
							className="sm:col-span-2"
							label="Description"
							htmlFor="admin-job-description"
							required
							error={errors.description_markdown?.message}
						>
							<Textarea
								id="admin-job-description"
								required
								rows={7}
								aria-invalid={!!errors.description_markdown}
								aria-describedby={
									errors.description_markdown
										? "admin-job-description-error"
										: undefined
								}
								{...register("description_markdown")}
							/>
						</Field>
						<Field
							label="Application URL"
							htmlFor="admin-job-url"
							error={errors.external_url?.message}
						>
							<Input
								id="admin-job-url"
								type="url"
								placeholder="https://example.com/jobs"
								aria-invalid={!!errors.external_url}
								aria-describedby={
									errors.external_url ? "admin-job-url-error" : undefined
								}
								{...register("external_url")}
							/>
						</Field>
						<Field
							label="Button label"
							htmlFor="admin-job-cta"
							error={errors.call_to_action?.message}
						>
							<Input
								id="admin-job-cta"
								aria-invalid={!!errors.call_to_action}
								aria-describedby={
									errors.call_to_action ? "admin-job-cta-error" : undefined
								}
								{...register("call_to_action")}
							/>
						</Field>
						<Field
							label="Contact name"
							htmlFor="admin-job-contact-name"
							required
							error={errors.contact_name?.message}
						>
							<Input
								id="admin-job-contact-name"
								required
								aria-invalid={!!errors.contact_name}
								aria-describedby={
									errors.contact_name
										? "admin-job-contact-name-error"
										: undefined
								}
								{...register("contact_name")}
							/>
						</Field>
						<Field
							label="Contact email"
							htmlFor="admin-job-contact-email"
							required
							error={errors.contact_email?.message}
						>
							<Input
								id="admin-job-contact-email"
								type="email"
								required
								aria-invalid={!!errors.contact_email}
								aria-describedby={
									errors.contact_email
										? "admin-job-contact-email-error"
										: undefined
								}
								{...register("contact_email")}
							/>
						</Field>
						<Field
							label="Contact role"
							htmlFor="admin-job-contact-role"
							error={errors.contact_role?.message}
						>
							<Input
								id="admin-job-contact-role"
								aria-invalid={!!errors.contact_role}
								aria-describedby={
									errors.contact_role
										? "admin-job-contact-role-error"
										: undefined
								}
								{...register("contact_role")}
							/>
						</Field>
						<Field
							label="Expiration date"
							htmlFor="admin-job-expires"
							error={errors.expires_at?.message}
						>
							<Input
								id="admin-job-expires"
								type="date"
								aria-invalid={!!errors.expires_at}
								aria-describedby={
									errors.expires_at ? "admin-job-expires-error" : undefined
								}
								{...register("expires_at")}
							/>
						</Field>
						<Field
							className="sm:col-span-2"
							label="Logo URL"
							htmlFor="admin-job-logo"
							error={errors.logo_url?.message}
						>
							<Input
								id="admin-job-logo"
								type="url"
								placeholder="https://example.com/logo.png"
								aria-invalid={!!errors.logo_url}
								aria-describedby={
									errors.logo_url ? "admin-job-logo-error" : undefined
								}
								{...register("logo_url")}
							/>
						</Field>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							disabled={isSaving}
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="bg-[#9A64D9] text-white hover:bg-[#523573]"
							disabled={isSaving}
						>
							<Save className="size-4" />
							{isSaving
								? "Saving..."
								: mode === "edit"
									? "Save changes"
									: "Publish job"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
