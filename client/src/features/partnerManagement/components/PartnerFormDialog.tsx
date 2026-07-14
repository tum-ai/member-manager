import type {
	CreatePartnerInput,
	ManagedPartner,
	PartnerTier,
} from "@member-manager/shared";
import { Controller, type UseFormReturn } from "react-hook-form";
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

interface PartnerFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	partner: ManagedPartner | null;
	tiers: PartnerTier[];
	form: UseFormReturn<CreatePartnerInput>;
	onSubmit: () => void;
	isSaving: boolean;
}

export function PartnerFormDialog({
	open,
	onOpenChange,
	partner,
	tiers,
	form,
	onSubmit,
	isSaving,
}: PartnerFormDialogProps) {
	const {
		register,
		control,
		formState: { errors },
	} = form;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{partner ? `Edit ${partner.companyName}` : "Add partner"}
					</DialogTitle>
					<DialogDescription>
						Partner Portal organization, contract, and package settings.
					</DialogDescription>
				</DialogHeader>

				<form
					id="partner-form"
					className="grid grid-cols-1 gap-4 sm:grid-cols-2"
					onSubmit={onSubmit}
					noValidate
				>
					<Field
						className="sm:col-span-2"
						label="Company name"
						htmlFor="partner-company-name"
						required
						error={errors.companyName?.message}
					>
						<Input
							id="partner-company-name"
							aria-invalid={!!errors.companyName}
							{...register("companyName")}
						/>
					</Field>

					<Field
						label="Primary contact email"
						htmlFor="partner-email"
						required
						description={
							partner
								? "The login email cannot be changed after creation."
								: "This address receives the Partner Portal activation email."
						}
						error={errors.primaryEmail?.message}
					>
						<Input
							id="partner-email"
							type="email"
							disabled={!!partner}
							aria-invalid={!!errors.primaryEmail}
							{...register("primaryEmail")}
						/>
					</Field>

					<Field
						label="Partnership tier"
						htmlFor="partner-tier"
						required
						error={errors.tierId?.message}
					>
						<Controller
							control={control}
							name="tierId"
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange}>
									<SelectTrigger
										id="partner-tier"
										className="w-full"
										aria-invalid={!!errors.tierId}
									>
										<SelectValue placeholder="Select a tier" />
									</SelectTrigger>
									<SelectContent>
										{tiers.map((tier) => (
											<SelectItem key={tier.id} value={tier.id}>
												{tier.displayName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
					</Field>

					<Field
						label="Partner type"
						htmlFor="partner-kind"
						required
						error={errors.partnerKind?.message}
					>
						<Controller
							control={control}
							name="partnerKind"
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange}>
									<SelectTrigger
										id="partner-kind"
										className="w-full"
										aria-invalid={!!errors.partnerKind}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="tier_subscriber">
											Long-term partner
										</SelectItem>
										<SelectItem value="single_job_buyer">
											Single job posting
										</SelectItem>
									</SelectContent>
								</Select>
							)}
						/>
					</Field>

					<Field
						label="Website"
						htmlFor="partner-website"
						error={errors.websiteUrl?.message}
					>
						<Input
							id="partner-website"
							type="url"
							placeholder="https://example.com"
							aria-invalid={!!errors.websiteUrl}
							{...register("websiteUrl")}
						/>
					</Field>

					<Field
						label="Contract start"
						htmlFor="partner-contract-start"
						required
						error={errors.contractStart?.message}
					>
						<Input
							id="partner-contract-start"
							type="date"
							aria-invalid={!!errors.contractStart}
							{...register("contractStart")}
						/>
					</Field>

					<Field
						label="Contract end"
						htmlFor="partner-contract-end"
						required
						error={errors.contractEnd?.message}
					>
						<Input
							id="partner-contract-end"
							type="date"
							aria-invalid={!!errors.contractEnd}
							{...register("contractEnd")}
						/>
					</Field>

					<Field
						className="sm:col-span-2"
						label="Internal notes"
						htmlFor="partner-notes"
						error={errors.notes?.message}
					>
						<Textarea
							id="partner-notes"
							rows={4}
							aria-invalid={!!errors.notes}
							{...register("notes")}
						/>
					</Field>
				</form>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						type="submit"
						form="partner-form"
						className="bg-[#9A64D9] text-white hover:bg-[#523573]"
						disabled={isSaving}
					>
						{isSaving
							? "Saving..."
							: partner
								? "Save changes"
								: "Create partner"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
