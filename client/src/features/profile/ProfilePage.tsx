import { Save } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CvPanel } from "./CvPanel";
import { LinksSection } from "./components/LinksSection";
import { PersonalInfoSection } from "./components/PersonalInfoSection";
import { ProfileAgreementModals } from "./components/ProfileAgreementModals";
import { ProfilePageSkeleton } from "./components/ProfilePageSkeleton";
import { ProfileSidebar } from "./components/ProfileSidebar";
import { RoleChangeRequestSection } from "./components/RoleChangeRequestSection";
import { SepaPanel } from "./components/SepaPanel";
import { TumaiProfileSection } from "./components/TumaiProfileSection";
import { useMemberChangeRequestForm } from "./hooks/useMemberChangeRequestForm";
import { useMembershipProof } from "./hooks/useMembershipProof";
import { useProfileForm } from "./hooks/useProfileForm";
import { useProfileNavigation } from "./hooks/useProfileNavigation";
import type { ProfilePageProps } from "./profileTypes";

export { ProfilePageSkeleton };

export default function ProfilePage({ user }: ProfilePageProps): JSX.Element {
	const fieldId = useId();
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);
	const [showDataPrivacyNoticeModal, setShowDataPrivacyNoticeModal] =
		useState(false);
	const [pendingMandateAgreed, setPendingMandateAgreed] = useState(false);
	const [pendingPrivacyAgreed, setPendingPrivacyAgreed] = useState(false);
	const [pendingDataPrivacyNoticeAgreed, setPendingDataPrivacyNoticeAgreed] =
		useState(false);

	const {
		memberForm,
		linkedinForm,
		sepaForm,
		memberData,
		isAdmin,
		isLoading,
		isUpdating,
		isLoadingResearchProjects,
		onSubmit,
		completeness,
		missingProfileFields,
		normalizedLinkedinUrl,
		isLinkedinUrlValid,
		currentRole,
		currentDepartment,
		isResearchDepartmentSelected,
		researchProjectOptions,
		researchProjectSelectValue,
	} = useProfileForm(user);

	const { isGeneratingPdf, handleDownloadMembershipProof } =
		useMembershipProof(memberData);

	const changeRequestForm = useMemberChangeRequestForm(user.id);

	const { activeSection, navItems, handleNavClick } = useProfileNavigation({
		isLoading,
		isAdmin,
	});

	const mandateAgreed = sepaForm.watch("mandate_agreed");
	const privacyAgreed = sepaForm.watch("privacy_agreed");
	const dataPrivacyNoticeAgreed = sepaForm.watch("data_privacy_notice_agreed");
	const isActive = memberForm.watch("active");

	const openSepaModal = () => {
		setPendingMandateAgreed(mandateAgreed);
		setShowSepaModal(true);
	};

	const openPrivacyModal = () => {
		setPendingPrivacyAgreed(privacyAgreed);
		setShowPrivacyModal(true);
	};

	const openDataPrivacyNoticeModal = () => {
		setPendingDataPrivacyNoticeAgreed(dataPrivacyNoticeAgreed);
		setShowDataPrivacyNoticeModal(true);
	};

	if (isLoading) {
		return <ProfilePageSkeleton />;
	}

	const headerGivenName = memberForm.watch("given_name") ?? "";
	const headerSurname = memberForm.watch("surname") ?? "";
	const headerFullName = `${headerGivenName} ${headerSurname}`.trim();
	const headerInitials =
		`${headerGivenName.charAt(0)}${headerSurname.charAt(0)}`.toUpperCase() ||
		"?";
	const headerDepartment = memberForm.watch("department");
	const headerRole = memberForm.watch("member_role") || "Member";
	const headerMeta = [headerDepartment, headerRole].filter(Boolean).join(" · ");

	return (
		<div>
			<form onSubmit={memberForm.handleSubmit(onSubmit)}>
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
					<ProfileSidebar
						avatarUrl={memberData?.avatar_url}
						headerFullName={headerFullName}
						headerInitials={headerInitials}
						headerMeta={headerMeta}
						isActive={isActive}
						memberStatus={memberForm.watch("member_status")}
						completeness={completeness}
						missingProfileFields={missingProfileFields}
						isGeneratingPdf={isGeneratingPdf}
						canDownloadProof={Boolean(memberData)}
						onDownloadMembershipProof={handleDownloadMembershipProof}
						navItems={navItems}
						activeSection={activeSection}
						onNavClick={handleNavClick}
						isUpdating={isUpdating}
					/>

					<div className="flex flex-col gap-6 lg:col-span-8">
						<PersonalInfoSection
							memberForm={memberForm}
							email={memberData?.email || user.email || ""}
							ids={{
								salutation: `${fieldId}-salutation`,
								title: `${fieldId}-title`,
								givenName: `${fieldId}-given-name`,
								surname: `${fieldId}-surname`,
								email: `${fieldId}-email`,
								dob: `${fieldId}-dob`,
								street: `${fieldId}-street`,
								number: `${fieldId}-number`,
								postalCode: `${fieldId}-postal-code`,
								city: `${fieldId}-city`,
								country: `${fieldId}-country`,
							}}
						/>

						<TumaiProfileSection
							memberForm={memberForm}
							isAdmin={isAdmin}
							currentRole={currentRole}
							currentDepartment={currentDepartment}
							isResearchDepartmentSelected={isResearchDepartmentSelected}
							isLoadingResearchProjects={isLoadingResearchProjects}
							researchProjectOptions={researchProjectOptions}
							researchProjectSelectValue={researchProjectSelectValue}
							ids={{
								batch: `${fieldId}-batch`,
								department: `${fieldId}-department`,
								role: `${fieldId}-role`,
								researchProject: `${fieldId}-research-project`,
								reimbursementNotifications: `${fieldId}-reimbursement-notifications`,
							}}
						/>

						<LinksSection
							linkedinForm={linkedinForm}
							isLinkedinUrlValid={isLinkedinUrlValid}
							normalizedLinkedinUrl={normalizedLinkedinUrl}
							ids={{
								linkedinUrl: `${fieldId}-linkedin-url`,
								publicLocation: `${fieldId}-public-location`,
							}}
						/>

						<CvPanel userId={user.id} id="cv" className="scroll-mt-20" />

						{!isAdmin && (
							<RoleChangeRequestSection
								requestedRole={changeRequestForm.requestedRole}
								setRequestedRole={changeRequestForm.setRequestedRole}
								requestedDepartment={changeRequestForm.requestedDepartment}
								setRequestedDepartment={
									changeRequestForm.setRequestedDepartment
								}
								isRequestingAlumniStatus={
									changeRequestForm.isRequestingAlumniStatus
								}
								setIsRequestingAlumniStatus={
									changeRequestForm.setIsRequestingAlumniStatus
								}
								changeRequestReason={changeRequestForm.changeRequestReason}
								setChangeRequestReason={
									changeRequestForm.setChangeRequestReason
								}
								latestMemberChangeRequest={
									changeRequestForm.latestMemberChangeRequest
								}
								isSubmittingChangeRequest={
									changeRequestForm.isSubmittingChangeRequest
								}
								onSubmitMemberChangeRequest={
									changeRequestForm.handleSubmitMemberChangeRequest
								}
								ids={{
									requestedRole: `${fieldId}-requested-role`,
									requestedDepartment: `${fieldId}-requested-department`,
									alumniCheckbox: `${fieldId}-alumni`,
									reason: `${fieldId}-reason`,
								}}
							/>
						)}

						<SepaPanel
							sepaForm={sepaForm}
							mandateAgreed={mandateAgreed}
							privacyAgreed={privacyAgreed}
							dataPrivacyNoticeAgreed={dataPrivacyNoticeAgreed}
							openSepaModal={openSepaModal}
							openPrivacyModal={openPrivacyModal}
							openDataPrivacyNoticeModal={openDataPrivacyNoticeModal}
							ids={{
								iban: `${fieldId}-iban`,
								bic: `${fieldId}-bic`,
								bankName: `${fieldId}-bank-name`,
								mandate: `${fieldId}-mandate`,
								privacy: `${fieldId}-privacy`,
								dataPrivacy: `${fieldId}-data-privacy`,
							}}
						/>

						<Button
							type="submit"
							size="lg"
							className="w-full lg:hidden"
							disabled={isUpdating}
						>
							{isUpdating ? (
								<Spinner className="size-5" />
							) : (
								<Save className="size-4" />
							)}
							{isUpdating ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</form>

			<ProfileAgreementModals
				sepaForm={sepaForm}
				showSepaModal={showSepaModal}
				setShowSepaModal={setShowSepaModal}
				showPrivacyModal={showPrivacyModal}
				setShowPrivacyModal={setShowPrivacyModal}
				showDataPrivacyNoticeModal={showDataPrivacyNoticeModal}
				setShowDataPrivacyNoticeModal={setShowDataPrivacyNoticeModal}
				pendingMandateAgreed={pendingMandateAgreed}
				setPendingMandateAgreed={setPendingMandateAgreed}
				pendingPrivacyAgreed={pendingPrivacyAgreed}
				setPendingPrivacyAgreed={setPendingPrivacyAgreed}
				pendingDataPrivacyNoticeAgreed={pendingDataPrivacyNoticeAgreed}
				setPendingDataPrivacyNoticeAgreed={setPendingDataPrivacyNoticeAgreed}
			/>
		</div>
	);
}
