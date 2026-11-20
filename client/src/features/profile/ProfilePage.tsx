import { Save } from "lucide-react";
import { useId } from "react";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Member } from "@/types";
import { CvPanel } from "./CvPanel";
import { DoorPinSection } from "./components/DoorPinSection";
import { LinksSection } from "./components/LinksSection";
import { PersonalInfoSection } from "./components/PersonalInfoSection";
import { ProfileAgreementModals } from "./components/ProfileAgreementModals";
import { ProfileConflictBanner } from "./components/ProfileConflictBanner";
import { ProfileLoadError } from "./components/ProfileLoadError";
import { ProfilePageSkeleton } from "./components/ProfilePageSkeleton";
import { ProfileSidebar } from "./components/ProfileSidebar";
import { RoleChangeRequestSection } from "./components/RoleChangeRequestSection";
import { SepaPanel } from "./components/SepaPanel";
import { TumaiProfileSection } from "./components/TumaiProfileSection";
import { useAgreementModals } from "./hooks/useAgreementModals";
import { useDoorPin } from "./hooks/useDoorPin";
import { useMemberChangeRequestForm } from "./hooks/useMemberChangeRequestForm";
import { useMembershipProof } from "./hooks/useMembershipProof";
import {
	type UseProfileFormResult,
	useProfileForm,
} from "./hooks/useProfileForm";
import { useProfileNavigation } from "./hooks/useProfileNavigation";
import { getProfileHeader } from "./profileHeader";
import type { ProfilePageProps } from "./profileTypes";

export { ProfilePageSkeleton };

interface ProfileFormViewProps extends ProfilePageProps {
	profileForm: UseProfileFormResult;
	navigation: ReturnType<typeof useProfileNavigation>;
}

function ProfileFormView({
	user,
	profileForm,
	navigation,
}: ProfileFormViewProps): JSX.Element {
	const fieldId = useId();
	const { activeSection, navItems, handleNavClick } = navigation;
	const {
		form,
		profile,
		memberConsents,
		isAdmin,
		isUpdating,
		isLoadingResearchProjects,
		onSubmit,
		completeness,
		missingProfileFields,
		suggestedFields,
		conflict,
		reloadLatest,
		keepMyChanges,
		currentRole,
		currentDepartment,
		isResearchDepartmentSelected,
		researchProjectOptions,
		researchProjectSelectValue,
	} = profileForm;
	const memberData = profile?.member;

	const { isGeneratingPdf, handleDownloadMembershipProof } = useMembershipProof(
		memberData as unknown as Member | undefined,
	);
	const changeRequestForm = useMemberChangeRequestForm(user.id);
	const doorPin = useDoorPin(user.id);
	const agreementModals = useAgreementModals(form);

	const header = getProfileHeader(form.watch());

	return (
		<FormProvider {...form}>
			{/* noValidate: the Zod schemas own validation. Native `required`
			    checks would block submit before onSubmit could run (#304). */}
			<form onSubmit={onSubmit} noValidate>
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
					{conflict && (
						<ProfileConflictBanner
							onReloadLatest={reloadLatest}
							onKeepMyChanges={keepMyChanges}
						/>
					)}
					<ProfileSidebar
						avatarUrl={memberData?.avatar_url}
						headerFullName={header.fullName}
						headerInitials={header.initials}
						headerMeta={header.meta}
						isActive={memberData?.active ?? true}
						memberStatus={memberData?.member_status ?? undefined}
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
							email={memberData?.email || user.email || ""}
							suggestedFields={suggestedFields}
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
							isAdmin={isAdmin}
							currentRole={currentRole}
							currentDepartment={currentDepartment}
							isResearchDepartmentSelected={isResearchDepartmentSelected}
							isLoadingResearchProjects={isLoadingResearchProjects}
							researchProjectOptions={researchProjectOptions}
							researchProjectSelectValue={researchProjectSelectValue}
							suggestedFields={suggestedFields}
							ids={{
								batch: `${fieldId}-batch`,
								department: `${fieldId}-department`,
								role: `${fieldId}-role`,
								researchProject: `${fieldId}-research-project`,
								reimbursementNotifications: `${fieldId}-reimbursement-notifications`,
							}}
						/>

						<DoorPinSection
							doorPin={doorPin.doorPin}
							isLoading={doorPin.isLoading}
							hasError={doorPin.hasError}
							isRevealed={doorPin.isRevealed}
							onToggleRevealed={doorPin.toggleRevealed}
						/>

						<LinksSection
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
								memberChangeRequests={changeRequestForm.memberChangeRequests}
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
							mandateAgreed={agreementModals.mandateAgreed}
							privacyAgreed={agreementModals.privacyAgreed}
							memberConsents={memberConsents}
							openSepaModal={agreementModals.openSepaModal}
							openPrivacyModal={agreementModals.openPrivacyModal}
							ids={{
								iban: `${fieldId}-iban`,
								bic: `${fieldId}-bic`,
								bankName: `${fieldId}-bank-name`,
								mandate: `${fieldId}-mandate`,
								privacy: `${fieldId}-privacy`,
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

			<ProfileAgreementModals {...agreementModals.modalProps} />
		</FormProvider>
	);
}

export default function ProfilePage({ user }: ProfilePageProps): JSX.Element {
	const profileForm = useProfileForm(user);
	const navigation = useProfileNavigation({
		isLoading: profileForm.isLoading,
		isAdmin: profileForm.isAdmin,
	});

	if (profileForm.isLoading) {
		return <ProfilePageSkeleton />;
	}
	if (profileForm.loadError) {
		return <ProfileLoadError message={profileForm.loadError.message} />;
	}

	return (
		<ProfileFormView
			user={user}
			profileForm={profileForm}
			navigation={navigation}
		/>
	);
}
