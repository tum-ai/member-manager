import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Spinner } from "@/components/ui/spinner";
import type { SepaSchema } from "@/lib/schemas";

interface BankingDetailsSectionProps {
	sepaForm: UseFormReturn<SepaSchema>;
	isUpdating: boolean;
	onOpenSepaModal: () => void;
	onOpenPrivacyModal: () => void;
	onOpenDataPrivacyNoticeModal: () => void;
	onCancel: () => void;
}

export function BankingDetailsSection({
	sepaForm,
	isUpdating,
	onOpenSepaModal,
	onOpenPrivacyModal,
	onOpenDataPrivacyNoticeModal,
	onCancel,
}: BankingDetailsSectionProps) {
	return (
		<div className="lg:w-96 bg-muted/50 p-6 sm:p-8 flex flex-col justify-between">
			<div>
				<h2 className="text-xl font-semibold text-foreground mb-6 pb-4 border-b border-border">
					Banking Details
				</h2>

				<div className="space-y-4">
					<Field
						label="IBAN"
						htmlFor="iban"
						required
						error={sepaForm.formState.errors.iban?.message}
					>
						<Input
							id="iban"
							{...sepaForm.register("iban")}
							aria-invalid={!!sepaForm.formState.errors.iban}
							className="font-mono"
							placeholder="DE..."
						/>
					</Field>

					<Field label="BIC" htmlFor="bic">
						<Input
							id="bic"
							{...sepaForm.register("bic")}
							className="font-mono"
						/>
					</Field>

					<Field
						label="Bank Name"
						htmlFor="bank_name"
						required
						error={sepaForm.formState.errors.bank_name?.message}
					>
						<Input
							id="bank_name"
							{...sepaForm.register("bank_name")}
							aria-invalid={!!sepaForm.formState.errors.bank_name}
						/>
					</Field>

					<div className="pt-4 space-y-3">
						<Controller
							control={sepaForm.control}
							name="mandate_agreed"
							render={({ field }) => (
								<CheckboxCard
									checked={field.value}
									onCheckedChange={(checked) => {
										const next = checked === true;
										sepaForm.setValue("mandate_agreed", next, {
											shouldDirty: true,
										});
										if (!sepaForm.getValues("mandate_agreed") && next) {
											onOpenSepaModal();
										}
									}}
								>
									I agree to the{" "}
									<LinkButton
										className="font-medium"
										onClick={(e) => {
											e.preventDefault();
											onOpenSepaModal();
										}}
									>
										SEPA mandate
									</LinkButton>
								</CheckboxCard>
							)}
						/>

						<Controller
							control={sepaForm.control}
							name="privacy_agreed"
							render={({ field }) => (
								<CheckboxCard
									checked={field.value}
									disabled={sepaForm.getValues("privacy_agreed")}
									onCheckedChange={(checked) => {
										const next = checked === true;
										sepaForm.setValue("privacy_agreed", next, {
											shouldDirty: true,
										});
										if (!sepaForm.getValues("privacy_agreed") && next) {
											onOpenPrivacyModal();
										}
									}}
								>
									I agree to the{" "}
									<LinkButton
										className="font-medium"
										onClick={(e) => {
											e.preventDefault();
											onOpenPrivacyModal();
										}}
									>
										Privacy Policy
									</LinkButton>{" "}
									*
								</CheckboxCard>
							)}
						/>

						<Controller
							control={sepaForm.control}
							name="data_privacy_notice_agreed"
							render={() => (
								<CheckboxCard
									checked={sepaForm.getValues("data_privacy_notice_agreed")}
									disabled={sepaForm.getValues("data_privacy_notice_agreed")}
									onCheckedChange={(checked) => {
										if (checked === true) {
											onOpenDataPrivacyNoticeModal();
											return;
										}
										sepaForm.setValue("data_privacy_notice_agreed", false, {
											shouldDirty: true,
										});
									}}
								>
									I agree to the{" "}
									<LinkButton
										className="font-medium"
										onClick={(e) => {
											e.preventDefault();
											onOpenDataPrivacyNoticeModal();
										}}
									>
										Data Privacy Notice
									</LinkButton>{" "}
									*
								</CheckboxCard>
							)}
						/>
					</div>
				</div>
			</div>

			<div className="mt-8 pt-6 border-t border-border flex flex-col gap-3">
				<Button type="submit" disabled={isUpdating} className="w-full">
					{isUpdating ? (
						<span className="flex items-center justify-center gap-2">
							<Spinner />
							Saving...
						</span>
					) : (
						"Save Changes"
					)}
				</Button>
				<Button
					type="button"
					variant="ghost"
					className="w-full text-muted-foreground"
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
