import { Landmark } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { GlassCard } from "../../../components/ui/GlassCard";
import type { SepaSchema } from "../../../lib/schemas";
import { SectionHeading } from "./SectionHeading";

interface SepaPanelProps {
	sepaForm: UseFormReturn<SepaSchema>;
	mandateAgreed: boolean;
	privacyAgreed: boolean;
	dataPrivacyNoticeAgreed: boolean;
	openSepaModal: () => void;
	openPrivacyModal: () => void;
	openDataPrivacyNoticeModal: () => void;
	ids: {
		iban: string;
		bic: string;
		bankName: string;
		mandate: string;
		privacy: string;
		dataPrivacy: string;
	};
}

export function SepaPanel({
	sepaForm,
	mandateAgreed,
	privacyAgreed,
	dataPrivacyNoticeAgreed,
	openSepaModal,
	openPrivacyModal,
	openDataPrivacyNoticeModal,
	ids,
}: SepaPanelProps): JSX.Element {
	return (
		<GlassCard id="banking" variant="elevated" className="scroll-mt-20">
			<CardContent className="p-6">
				<SectionHeading
					icon={Landmark}
					title="Banking & agreements"
					description="Your SEPA details and required agreements."
				/>

				<div className="mb-6 grid gap-4">
					<Field
						label="IBAN"
						htmlFor={ids.iban}
						required
						error={sepaForm.formState.errors.iban?.message}
					>
						<Input
							id={ids.iban}
							{...sepaForm.register("iban")}
							aria-invalid={!!sepaForm.formState.errors.iban}
							className="font-mono"
							required
						/>
					</Field>
					<Field label="BIC" htmlFor={ids.bic}>
						<Input id={ids.bic} {...sepaForm.register("bic")} />
					</Field>
					<Field
						label="Bank Name"
						htmlFor={ids.bankName}
						required
						error={sepaForm.formState.errors.bank_name?.message}
					>
						<Input
							id={ids.bankName}
							{...sepaForm.register("bank_name")}
							aria-invalid={!!sepaForm.formState.errors.bank_name}
							required
						/>
					</Field>
				</div>

				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Checkbox
							id={ids.mandate}
							checked={mandateAgreed}
							onCheckedChange={(checked) => {
								if (checked === true) {
									openSepaModal();
									return;
								}
								sepaForm.setValue("mandate_agreed", false, {
									shouldDirty: true,
									shouldValidate: true,
								});
							}}
						/>
						<Label htmlFor={ids.mandate} className="font-normal">
							<span className="text-sm">
								I agree to the{" "}
								<LinkButton
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										openSepaModal();
									}}
								>
									SEPA mandate
								</LinkButton>
							</span>
						</Label>
					</div>
					{sepaForm.formState.errors.mandate_agreed && (
						<p className="mb-1 block text-xs text-destructive">
							{sepaForm.formState.errors.mandate_agreed.message}
						</p>
					)}

					<div className="flex items-center gap-2">
						<Checkbox
							id={ids.privacy}
							checked={privacyAgreed}
							onCheckedChange={(checked) => {
								if (checked === true) {
									openPrivacyModal();
									return;
								}
								sepaForm.setValue("privacy_agreed", false, {
									shouldDirty: true,
									shouldValidate: true,
								});
							}}
						/>
						<Label htmlFor={ids.privacy} className="font-normal">
							<span className="text-sm">
								I agree to the{" "}
								<LinkButton
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										openPrivacyModal();
									}}
								>
									Privacy Policy
								</LinkButton>{" "}
								*
							</span>
						</Label>
					</div>
					{sepaForm.formState.errors.privacy_agreed && (
						<p className="mb-1 block text-xs text-destructive">
							{sepaForm.formState.errors.privacy_agreed.message}
						</p>
					)}

					<div className="flex items-center gap-2">
						<Checkbox
							id={ids.dataPrivacy}
							checked={dataPrivacyNoticeAgreed}
							onCheckedChange={(checked) => {
								if (checked === true) {
									openDataPrivacyNoticeModal();
									return;
								}
								sepaForm.setValue("data_privacy_notice_agreed", false, {
									shouldDirty: true,
									shouldValidate: true,
								});
							}}
						/>
						<Label htmlFor={ids.dataPrivacy} className="font-normal">
							<span className="text-sm">
								I agree to the{" "}
								<LinkButton
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										openDataPrivacyNoticeModal();
									}}
								>
									Data Privacy Notice
								</LinkButton>{" "}
								*
							</span>
						</Label>
					</div>
					{sepaForm.formState.errors.data_privacy_notice_agreed && (
						<p className="block text-xs text-destructive">
							{sepaForm.formState.errors.data_privacy_notice_agreed.message}
						</p>
					)}
				</div>
			</CardContent>
		</GlassCard>
	);
}
