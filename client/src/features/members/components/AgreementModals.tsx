import type { UseFormReturn } from "react-hook-form";
import { Modal } from "@/components/ui/Modal";
import { DataPrivacyNotice } from "@/features/legal/DataPrivacyNotice";
import { PrivacyPolicy } from "@/features/legal/PrivacyPolicy";
import { SepaMandate } from "@/features/sepa/SepaMandate";
import type { SepaSchema } from "@/lib/schemas";

interface AgreementModalsProps {
	sepaForm: UseFormReturn<SepaSchema>;
	mandateAgreed: boolean;
	privacyAgreed: boolean;
	dataPrivacyNoticeAgreed: boolean;
	showSepaModal: boolean;
	showPrivacyModal: boolean;
	showDataPrivacyNoticeModal: boolean;
	onCloseSepaModal: () => void;
	onClosePrivacyModal: () => void;
	onCloseDataPrivacyNoticeModal: () => void;
}

export function AgreementModals({
	sepaForm,
	mandateAgreed,
	privacyAgreed,
	dataPrivacyNoticeAgreed,
	showSepaModal,
	showPrivacyModal,
	showDataPrivacyNoticeModal,
	onCloseSepaModal,
	onClosePrivacyModal,
	onCloseDataPrivacyNoticeModal,
}: AgreementModalsProps) {
	const { dirtyFields: sepaDirtyFields } = sepaForm.formState;

	return (
		<>
			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={onCloseSepaModal}
					confirmDisabled={!mandateAgreed || !sepaDirtyFields.mandate_agreed}
					onConfirm={() => {
						sepaForm.setValue("mandate_agreed", true, { shouldDirty: true });
						window.dispatchEvent(
							new CustomEvent("sepa-updated", {
								detail: { mandate_agreed: true },
							}),
						);
						onCloseSepaModal();
					}}
				>
					<SepaMandate
						sepaAgreed={mandateAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("mandate_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}

			{showPrivacyModal && (
				<Modal
					title="Privacy Policy Agreement"
					onClose={onClosePrivacyModal}
					confirmDisabled={!privacyAgreed || !sepaDirtyFields.privacy_agreed}
					onConfirm={() => {
						sepaForm.setValue("privacy_agreed", true, { shouldDirty: true });
						window.dispatchEvent(
							new CustomEvent("privacy-updated", {
								detail: { privacy_agreed: true },
							}),
						);
						onClosePrivacyModal();
					}}
				>
					<PrivacyPolicy
						privacyAgreed={privacyAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("privacy_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}

			{showDataPrivacyNoticeModal && (
				<Modal
					title="Data Privacy Notice Agreement"
					onClose={onCloseDataPrivacyNoticeModal}
					confirmDisabled={
						!dataPrivacyNoticeAgreed ||
						!sepaDirtyFields.data_privacy_notice_agreed
					}
					onConfirm={() => {
						sepaForm.setValue("data_privacy_notice_agreed", true, {
							shouldDirty: true,
						});
						window.dispatchEvent(
							new CustomEvent("data-privacy-notice-updated", {
								detail: { data_privacy_notice_agreed: true },
							}),
						);
						onCloseDataPrivacyNoticeModal();
					}}
				>
					<DataPrivacyNotice
						dataPrivacyNoticeAgreed={dataPrivacyNoticeAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("data_privacy_notice_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}
		</>
	);
}
