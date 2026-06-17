import type { UseFormReturn } from "react-hook-form";
import { Modal } from "../../../components/ui/Modal";
import type { SepaSchema } from "../../../lib/schemas";
import { DataPrivacyNotice } from "../../legal/DataPrivacyNotice";
import { PrivacyPolicy } from "../../legal/PrivacyPolicy";
import { SepaMandate } from "../../sepa/SepaMandate";

interface ProfileAgreementModalsProps {
	sepaForm: UseFormReturn<SepaSchema>;
	showSepaModal: boolean;
	setShowSepaModal: (value: boolean) => void;
	showPrivacyModal: boolean;
	setShowPrivacyModal: (value: boolean) => void;
	showDataPrivacyNoticeModal: boolean;
	setShowDataPrivacyNoticeModal: (value: boolean) => void;
	pendingMandateAgreed: boolean;
	setPendingMandateAgreed: (value: boolean) => void;
	pendingPrivacyAgreed: boolean;
	setPendingPrivacyAgreed: (value: boolean) => void;
	pendingDataPrivacyNoticeAgreed: boolean;
	setPendingDataPrivacyNoticeAgreed: (value: boolean) => void;
}

export function ProfileAgreementModals({
	sepaForm,
	showSepaModal,
	setShowSepaModal,
	showPrivacyModal,
	setShowPrivacyModal,
	showDataPrivacyNoticeModal,
	setShowDataPrivacyNoticeModal,
	pendingMandateAgreed,
	setPendingMandateAgreed,
	pendingPrivacyAgreed,
	setPendingPrivacyAgreed,
	pendingDataPrivacyNoticeAgreed,
	setPendingDataPrivacyNoticeAgreed,
}: ProfileAgreementModalsProps): JSX.Element {
	return (
		<>
			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={() => setShowSepaModal(false)}
					confirmDisabled={!pendingMandateAgreed}
					onConfirm={() => {
						sepaForm.setValue("mandate_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowSepaModal(false);
					}}
				>
					<SepaMandate
						sepaAgreed={pendingMandateAgreed}
						onCheckChange={setPendingMandateAgreed}
					/>
				</Modal>
			)}

			{showPrivacyModal && (
				<Modal
					title="Privacy Policy Agreement"
					onClose={() => setShowPrivacyModal(false)}
					confirmDisabled={!pendingPrivacyAgreed}
					onConfirm={() => {
						sepaForm.setValue("privacy_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowPrivacyModal(false);
					}}
				>
					<PrivacyPolicy
						privacyAgreed={pendingPrivacyAgreed}
						onCheckChange={setPendingPrivacyAgreed}
					/>
				</Modal>
			)}

			{showDataPrivacyNoticeModal && (
				<Modal
					title="Data Privacy Notice Agreement"
					onClose={() => setShowDataPrivacyNoticeModal(false)}
					confirmDisabled={!pendingDataPrivacyNoticeAgreed}
					onConfirm={() => {
						sepaForm.setValue("data_privacy_notice_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowDataPrivacyNoticeModal(false);
					}}
				>
					<DataPrivacyNotice
						dataPrivacyNoticeAgreed={pendingDataPrivacyNoticeAgreed}
						onCheckChange={setPendingDataPrivacyNoticeAgreed}
					/>
				</Modal>
			)}
		</>
	);
}
