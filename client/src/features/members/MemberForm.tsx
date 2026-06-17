import type { User } from "@supabase/supabase-js";
import { AgreementModals } from "./components/AgreementModals";
import { BankingDetailsSection } from "./components/BankingDetailsSection";
import { PersonalInfoSection } from "./components/PersonalInfoSection";
import { useMemberForm } from "./hooks/useMemberForm";

interface MemberFormProps {
	user: User;
}

export function MemberForm({ user }: MemberFormProps) {
	const {
		memberForm,
		sepaForm,
		email,
		statusRequestMessage,
		showSepaModal,
		setShowSepaModal,
		showPrivacyModal,
		setShowPrivacyModal,
		showDataPrivacyNoticeModal,
		setShowDataPrivacyNoticeModal,
		mandateAgreed,
		privacyAgreed,
		dataPrivacyNoticeAgreed,
		isLoading,
		isUpdating,
		onSubmit,
		handleStatusChangeRequest,
		handleCancel,
	} = useMemberForm(user);

	if (isLoading)
		return (
			<div className="text-muted-foreground text-center p-8">Loading...</div>
		);

	return (
		<div className="flex justify-center items-start min-h-[calc(100vh-100px)] p-4 sm:p-8">
			<div className="w-full max-w-5xl bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
				<form
					onSubmit={memberForm.handleSubmit(onSubmit)}
					className="flex flex-col lg:flex-row"
				>
					<PersonalInfoSection
						memberForm={memberForm}
						email={email}
						statusRequestMessage={statusRequestMessage}
						onStatusChangeRequest={handleStatusChangeRequest}
					/>

					<BankingDetailsSection
						sepaForm={sepaForm}
						isUpdating={isUpdating}
						onOpenSepaModal={() => setShowSepaModal(true)}
						onOpenPrivacyModal={() => setShowPrivacyModal(true)}
						onOpenDataPrivacyNoticeModal={() =>
							setShowDataPrivacyNoticeModal(true)
						}
						onCancel={handleCancel}
					/>
				</form>
			</div>

			<AgreementModals
				sepaForm={sepaForm}
				mandateAgreed={mandateAgreed}
				privacyAgreed={privacyAgreed}
				dataPrivacyNoticeAgreed={dataPrivacyNoticeAgreed}
				showSepaModal={showSepaModal}
				showPrivacyModal={showPrivacyModal}
				showDataPrivacyNoticeModal={showDataPrivacyNoticeModal}
				onCloseSepaModal={() => setShowSepaModal(false)}
				onClosePrivacyModal={() => setShowPrivacyModal(false)}
				onCloseDataPrivacyNoticeModal={() =>
					setShowDataPrivacyNoticeModal(false)
				}
			/>
		</div>
	);
}
