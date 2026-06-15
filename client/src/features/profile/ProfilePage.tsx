import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import {
	CircleAlert,
	CircleCheck,
	Download,
	GraduationCap,
	Info,
	Landmark,
	Link,
	type LucideIcon,
	Save,
	Send,
	UserRound,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { useMemberChangeRequests } from "../../hooks/useMemberChangeRequests";
import { useMemberData } from "../../hooks/useMemberData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import { useSepaData } from "../../hooks/useSepaData";
import {
	BATCH_OPTIONS,
	DEPARTMENTS,
	getCurrentBatch,
	MEMBER_ROLES,
} from "../../lib/constants";
import {
	isLinkedinProfileUrl,
	normalizeLinkedinProfileUrl,
} from "../../lib/linkedin";
import {
	getEducationEntries,
	getMemberStatusLabel,
	resolveDepartmentForMemberRole,
	serializeEducationEntries,
} from "../../lib/memberMetadata";
import { downloadPdfBlob } from "../../lib/pdfUtils";
import { getResearchProjectSelectValue } from "../../lib/researchProjects";
import {
	type LinkedinSchema,
	linkedinSchema,
	type MemberSchema,
	memberSchema,
	type SepaSchema,
	sepaSchema,
} from "../../lib/schemas";
import { generateMembershipProofPdf } from "../certificate/generators/membershipProofPdf";
import DataPrivacyNotice from "../legal/DataPrivacyNotice";
import PrivacyPolicy from "../legal/PrivacyPolicy";
import SepaMandate from "../sepa/SepaMandate";
import CvPanel from "./CvPanel";
import EducationFields from "./EducationFields";
import {
	buildSelfServiceMemberUpdatePayload,
	computeProfileCompleteness,
} from "./profileFormUtils";

// Radix Select forbids empty-string item values, so an empty selection is
// represented by this sentinel and mapped back to "" at the boundary.
const NONE_VALUE = "__none__";
const toSelectValue = (value: string): string =>
	value === "" ? NONE_VALUE : value;
const fromSelectValue = (value: string): string =>
	value === NONE_VALUE ? "" : value;

interface ProfilePageProps {
	user: User;
}

function extractSlackProfile(user: User): {
	given_name: string;
	surname: string;
} {
	const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
	const getString = (key: string): string => {
		const value = metadata[key];
		return typeof value === "string" ? value.trim() : "";
	};

	let given = getString("given_name") || getString("first_name");
	let family = getString("family_name") || getString("last_name");

	if (!given || !family) {
		const fullName = getString("name") || getString("full_name");
		if (fullName) {
			const parts = fullName.split(/\s+/);
			if (!given) given = parts[0] ?? "";
			if (!family && parts.length > 1) family = parts.slice(1).join(" ");
		}
	}

	return { given_name: given, surname: family };
}

function SectionHeading({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description?: string;
}): JSX.Element {
	return (
		<div className="mb-6">
			<div className="flex items-center gap-2.5">
				<Icon className="size-5 text-brand" />
				<h2 className="text-base font-semibold">{title}</h2>
			</div>
			{description && (
				<p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
			)}
		</div>
	);
}

export default function ProfilePage({ user }: ProfilePageProps): JSX.Element {
	const fieldId = useId();
	const { showToast } = useToast();
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);
	const [showDataPrivacyNoticeModal, setShowDataPrivacyNoticeModal] =
		useState(false);
	const [pendingMandateAgreed, setPendingMandateAgreed] = useState(false);
	const [pendingPrivacyAgreed, setPendingPrivacyAgreed] = useState(false);
	const [pendingDataPrivacyNoticeAgreed, setPendingDataPrivacyNoticeAgreed] =
		useState(false);
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
	const [requestedRole, setRequestedRole] = useState("");
	const [requestedDepartment, setRequestedDepartment] = useState("");
	const [isRequestingAlumniStatus, setIsRequestingAlumniStatus] =
		useState(false);
	const [changeRequestReason, setChangeRequestReason] = useState("");
	const [activeSection, setActiveSection] = useState("personal");

	const normalizeTextValue = (value?: string | null): string | null => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	};

	const normalizeSerializedTextValue = (
		value?: string | null,
	): string | null => {
		if (!value?.trim()) return null;
		return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	};

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(user.id);
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(user.id);
	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();
	const {
		requests: memberChangeRequests,
		submitChangeRequestAsync,
		isSubmitting: isSubmittingChangeRequest,
	} = useMemberChangeRequests(user.id);

	const {
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: isUpdatingSepa,
	} = useSepaData(user.id);

	const linkedinForm = useForm<LinkedinSchema>({
		resolver: zodResolver(linkedinSchema),
		defaultValues: {
			linkedin_profile_url: "",
			public_location: "",
		},
	});

	const linkedinUrl = linkedinForm.watch("linkedin_profile_url");
	const normalizedLinkedinUrl = normalizeLinkedinProfileUrl(linkedinUrl);
	const isLinkedinUrlValid = isLinkedinProfileUrl(linkedinUrl);

	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: {
			active: true,
			member_status: "active",
			salutation: "",
			title: "",
			surname: "",
			given_name: "",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "Germany",
			user_id: user.id,
			batch: "",
			department: "",
			member_role: "",
			degree: "",
			school: "",
		},
	});

	const sepaForm = useForm<SepaSchema>({
		resolver: zodResolver(sepaSchema),
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
			user_id: user.id,
		},
	});

	const mandateAgreed = sepaForm.watch("mandate_agreed");
	const privacyAgreed = sepaForm.watch("privacy_agreed");
	const dataPrivacyNoticeAgreed = sepaForm.watch("data_privacy_notice_agreed");
	const isActive = memberForm.watch("active");
	const shouldSubmitSepa = Boolean(sepaData) || sepaForm.formState.isDirty;

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

	useEffect(() => {
		if (isLoadingMember) return;

		const slackProfile = extractSlackProfile(user);
		const slackBatch = getCurrentBatch();
		const existing = memberData ?? {};

		memberForm.reset({
			active: existing.active ?? true,
			member_status:
				existing.member_status || (existing.active ? "active" : "inactive"),
			salutation: existing.salutation || "",
			title: existing.title || "",
			surname: existing.surname || slackProfile.surname,
			given_name: existing.given_name || slackProfile.given_name,
			date_of_birth: existing.date_of_birth || "",
			street: existing.street || "",
			number: existing.number || "",
			postal_code: existing.postal_code || "",
			city: existing.city || "",
			country: existing.country || "Germany",
			user_id: user.id,
			batch: existing.batch || slackBatch,
			department: existing.department || "",
			member_role: existing.member_role || "",
			research_project_id: existing.research_project_id || "",
			degree: existing.degree || "",
			school: existing.school || "",
		});

		// Populate LinkedIn form from DB data
		linkedinForm.reset({
			linkedin_profile_url:
				((existing as Record<string, unknown>)
					.linkedin_profile_url as string) || "",
			public_location:
				((existing as Record<string, unknown>).public_location as string) || "",
		});
	}, [memberData, isLoadingMember, memberForm, linkedinForm, user]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset({
				iban: sepaData.iban || "",
				bic: sepaData.bic || "",
				bank_name: sepaData.bank_name || "",
				mandate_agreed: sepaData.mandate_agreed || false,
				privacy_agreed: sepaData.privacy_agreed || false,
				data_privacy_notice_agreed:
					sepaData.data_privacy_notice_agreed || false,
				user_id: user.id,
			});
		}
	}, [sepaData, sepaForm, user.id]);

	const onSubmit = async (): Promise<void> => {
		try {
			const memberValid = await memberForm.trigger();
			const linkedinValid = await linkedinForm.trigger();
			const sepaValid = shouldSubmitSepa ? await sepaForm.trigger() : true;

			if (!memberValid || !linkedinValid || !sepaValid) {
				showToast(
					shouldSubmitSepa
						? "Please complete all required fields and agreements before saving."
						: "Please complete all required profile fields before saving.",
					"error",
				);
				return;
			}

			const promises: Promise<unknown>[] = [];
			const memberValues = memberForm.getValues();
			const linkedinValues = linkedinForm.getValues();
			const educationValues = serializeEducationEntries(
				getEducationEntries(memberValues.degree, memberValues.school),
			);
			const memberPayload = {
				...buildSelfServiceMemberUpdatePayload(memberValues, {
					includeAdminManagedFields: isAdmin,
				}),
				degree: normalizeSerializedTextValue(educationValues.degree),
				school: normalizeSerializedTextValue(educationValues.school),
				// LinkedIn fields submitted with the member payload
				linkedin_profile_url: normalizeTextValue(
					linkedinValues.linkedin_profile_url,
				),
				public_location: normalizeTextValue(linkedinValues.public_location),
			};
			let effectiveProfileDepartment = normalizeTextValue(
				memberValues.department,
			);
			if (isAdmin) {
				Object.assign(memberPayload, {
					batch: normalizeTextValue(memberValues.batch),
				});
				const normalizedRole = normalizeTextValue(memberValues.member_role);
				effectiveProfileDepartment = resolveDepartmentForMemberRole(
					normalizedRole || "Member",
					normalizeTextValue(memberValues.department),
				);
				Object.assign(memberPayload, {
					member_role: normalizedRole || "Member",
					department: effectiveProfileDepartment,
				});
			}
			if (effectiveProfileDepartment === "Research") {
				Object.assign(memberPayload, {
					research_project_id: normalizeTextValue(
						memberValues.research_project_id,
					),
				});
			} else if (isAdmin) {
				Object.assign(memberPayload, { research_project_id: null });
			} else {
				delete memberPayload.research_project_id;
			}
			promises.push(updateMemberAsync(memberPayload));
			if (shouldSubmitSepa) {
				promises.push(updateSepaAsync(sepaForm.getValues()));
			}

			await Promise.all(promises);
			showToast("Profile saved successfully!", "success");
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error saving: ${errorMessage}`, "error");
		}
	};

	const handleDownloadMembershipProof = async (): Promise<void> => {
		if (!memberData || isGeneratingPdf) return;

		setIsGeneratingPdf(true);
		try {
			const pdfBlob = await generateMembershipProofPdf(memberData);
			const safeGivenName = memberData.given_name.replace(
				/[^a-zA-Z0-9-_]/g,
				"-",
			);
			const safeSurname = memberData.surname.replace(/[^a-zA-Z0-9-_]/g, "-");
			const fullName = `${safeGivenName}-${safeSurname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Membership_Proof_${fullName}.pdf`);
			showToast("Membership proof downloaded!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to generate PDF: ${errorMessage}`, "error");
		} finally {
			setIsGeneratingPdf(false);
		}
	};

	const isLoading = isLoadingMember || isLoadingSepa || isLoadingAdminRole;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	// Highlight the sidebar nav link for whichever section is currently in view.
	useEffect(() => {
		if (isLoading) return;
		const ids = [
			"personal",
			"tumai",
			"links",
			"cv",
			"banking",
			...(isAdmin ? [] : ["requests"]),
		];

		let frame = 0;
		const update = () => {
			frame = 0;
			// Active = the last section whose top has crossed a trigger line. Each
			// section owns the line for a scroll range equal to its height, so even
			// short sections become active. Near the page bottom the line slides
			// toward the viewport bottom so short trailing sections still get a turn.
			const viewportHeight = window.innerHeight;
			const maxScroll = document.documentElement.scrollHeight - viewportHeight;
			const remaining = maxScroll - window.scrollY;
			const ratio =
				maxScroll <= 0
					? 1
					: Math.min(Math.max(remaining / viewportHeight, 0), 1);
			const baseLine = viewportHeight * 0.25;
			const triggerLine = baseLine + (viewportHeight - baseLine) * (1 - ratio);

			let current = ids[0];
			for (const id of ids) {
				const element = document.getElementById(id);
				if (element && element.getBoundingClientRect().top <= triggerLine) {
					current = id;
				}
			}
			setActiveSection(current);
		};
		const onScroll = () => {
			if (frame) return;
			frame = window.requestAnimationFrame(update);
		};

		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [isLoading, isAdmin]);

	const handleNavClick = (
		event: React.MouseEvent<HTMLAnchorElement>,
		id: string,
	) => {
		event.preventDefault();
		document
			.getElementById(id)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const navItems = [
		{ id: "personal", label: "Personal information" },
		{ id: "tumai", label: "TUM.ai profile" },
		{ id: "links", label: "LinkedIn & location" },
		{ id: "cv", label: "CV" },
		{ id: "banking", label: "Banking & agreements" },
		...(isAdmin ? [] : [{ id: "requests", label: "Request changes" }]),
	];

	const completeness = computeProfileCompleteness({
		member: memberForm.watch(),
		linkedin: linkedinForm.watch(),
		sepa: sepaForm.watch(),
	});
	const latestMemberChangeRequest = memberChangeRequests[0];
	const currentRole = memberForm.watch("member_role") || "Member";
	const currentDepartment = memberForm.watch("department") || "";
	const effectiveProfileDepartment = resolveDepartmentForMemberRole(
		currentRole,
		currentDepartment,
	);
	const researchProjectOptions = (researchProjects ?? []).filter((project) => {
		const status = project.status?.trim().toLowerCase();
		return !status || ["ongoing", "active", "in progress"].includes(status);
	});
	const researchProjectSelectValue = getResearchProjectSelectValue(
		memberForm.watch("research_project_id"),
		researchProjectOptions,
	);
	const isResearchDepartmentSelected =
		effectiveProfileDepartment === "Research";

	const handleSubmitMemberChangeRequest = async (): Promise<void> => {
		const memberRole = normalizeTextValue(requestedRole);
		const department = normalizeTextValue(requestedDepartment);
		const reason = changeRequestReason.trim();

		if (!memberRole && !department && !isRequestingAlumniStatus) {
			showToast(
				"Select a role, department, or alumni status change to request.",
				"warning",
			);
			return;
		}

		try {
			const changes: {
				member_role?: string;
				member_status?: string;
				department?: string;
			} = {};
			if (memberRole) changes.member_role = memberRole;
			if (department) changes.department = department;
			if (isRequestingAlumniStatus) changes.member_status = "alumni";

			await submitChangeRequestAsync({
				changes,
				reason: reason || undefined,
			});
			setRequestedRole("");
			setRequestedDepartment("");
			setIsRequestingAlumniStatus(false);
			setChangeRequestReason("");
			showToast("Change request sent to the admin and LnF team.", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to submit change request: ${errorMessage}`, "error");
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center gap-4">
				<Spinner className="size-6" />
				<p className="text-muted-foreground">Loading profile...</p>
			</div>
		);
	}

	const salutationId = `${fieldId}-salutation`;
	const titleId = `${fieldId}-title`;
	const givenNameId = `${fieldId}-given-name`;
	const surnameId = `${fieldId}-surname`;
	const emailId = `${fieldId}-email`;
	const dobId = `${fieldId}-dob`;
	const streetId = `${fieldId}-street`;
	const numberId = `${fieldId}-number`;
	const postalCodeId = `${fieldId}-postal-code`;
	const cityId = `${fieldId}-city`;
	const countryId = `${fieldId}-country`;
	const batchId = `${fieldId}-batch`;
	const departmentId = `${fieldId}-department`;
	const roleId = `${fieldId}-role`;
	const researchProjectId = `${fieldId}-research-project`;
	const linkedinUrlId = `${fieldId}-linkedin-url`;
	const publicLocationId = `${fieldId}-public-location`;
	const requestedRoleId = `${fieldId}-requested-role`;
	const requestedDepartmentId = `${fieldId}-requested-department`;
	const alumniCheckboxId = `${fieldId}-alumni`;
	const reasonId = `${fieldId}-reason`;
	const ibanId = `${fieldId}-iban`;
	const bicId = `${fieldId}-bic`;
	const bankNameId = `${fieldId}-bank-name`;

	const errors = memberForm.formState.errors;

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
					<aside className="flex flex-col gap-4 self-start lg:col-span-4 lg:sticky lg:top-20">
						<GlassCard variant="elevated">
							<CardContent className="p-6">
								<div className="flex items-center gap-4">
									<Avatar className="size-16 shrink-0 bg-muted">
										<AvatarImage
											src={memberData?.avatar_url || undefined}
											alt={headerFullName || "Member avatar"}
										/>
										<AvatarFallback className="bg-brand/10 text-lg font-semibold text-brand">
											{headerInitials}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0">
										<h1 className="truncate text-xl font-bold leading-tight">
											{headerFullName || "Your Profile"}
										</h1>
										{headerMeta && (
											<p className="mt-0.5 truncate text-sm text-muted-foreground">
												{headerMeta}
											</p>
										)}
									</div>
								</div>

								<Badge
									variant={isActive ? "success" : "neutral"}
									className="mt-4 gap-1.5 py-1"
								>
									{isActive ? (
										<CircleCheck className="size-[18px]" />
									) : (
										<CircleAlert className="size-[18px]" />
									)}
									{`${getMemberStatusLabel(memberForm.watch("member_status"))} Member`}
								</Badge>

								<div className="mt-5">
									<div className="mb-1.5 flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											Profile completeness
										</span>
										<span className="font-medium">{completeness}%</span>
									</div>
									<Progress value={completeness} />
								</div>

								<div className="my-5 border-t border-border" />

								<Button
									type="button"
									variant="outline"
									onClick={handleDownloadMembershipProof}
									disabled={isGeneratingPdf || !memberData}
									className="w-full"
								>
									{isGeneratingPdf ? (
										<Spinner className="size-4" />
									) : (
										<Download className="size-4" />
									)}
									{isGeneratingPdf ? "Generating..." : "Proof of Membership"}
								</Button>
							</CardContent>
						</GlassCard>

						<GlassCard variant="elevated" className="hidden lg:block">
							<CardContent className="p-4">
								<p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
									On this page
								</p>
								<nav className="flex flex-col">
									{navItems.map((item) => (
										<a
											key={item.id}
											href={`#${item.id}`}
											onClick={(event) => handleNavClick(event, item.id)}
											className={cn(
												"rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
												activeSection === item.id
													? "font-medium text-brand"
													: "text-muted-foreground",
											)}
										>
											{item.label}
										</a>
									))}
								</nav>
							</CardContent>
						</GlassCard>

						<Button
							type="submit"
							size="lg"
							className="hidden w-full lg:flex"
							disabled={isUpdating}
						>
							{isUpdating ? (
								<Spinner className="size-5" />
							) : (
								<Save className="size-4" />
							)}
							{isUpdating ? "Saving..." : "Save Changes"}
						</Button>
					</aside>

					<div className="flex flex-col gap-6 lg:col-span-8">
						<GlassCard
							id="personal"
							variant="elevated"
							className="scroll-mt-20"
						>
							<CardContent className="p-6">
								<SectionHeading
									icon={UserRound}
									title="Personal information"
									description="Your name and contact details."
								/>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
									<div className="grid gap-1.5 sm:col-span-4">
										<Label htmlFor={salutationId}>Salutation (optional)</Label>
										<Select
											value={toSelectValue(
												memberForm.watch("salutation") || "",
											)}
											onValueChange={(value) =>
												memberForm.setValue(
													"salutation",
													fromSelectValue(value),
													{ shouldDirty: true },
												)
											}
										>
											<SelectTrigger
												id={salutationId}
												className="w-full"
												aria-label="Salutation (optional)"
												aria-invalid={!!errors.salutation}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={NONE_VALUE}>None</SelectItem>
												<SelectItem value="Mr.">Mr.</SelectItem>
												<SelectItem value="Ms.">Ms.</SelectItem>
												<SelectItem value="Mx.">Mx.</SelectItem>
											</SelectContent>
										</Select>
										{errors.salutation?.message && (
											<p className="text-xs text-destructive">
												{errors.salutation.message}
											</p>
										)}
									</div>
									<div className="grid gap-1.5 sm:col-span-8">
										<Label htmlFor={titleId}>Title</Label>
										<Select
											value={toSelectValue(memberForm.watch("title") || "")}
											onValueChange={(value) =>
												memberForm.setValue("title", fromSelectValue(value), {
													shouldDirty: true,
												})
											}
										>
											<SelectTrigger
												id={titleId}
												className="w-full"
												aria-label="Title"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={NONE_VALUE}>None</SelectItem>
												<SelectItem value="Dr.">Dr.</SelectItem>
												<SelectItem value="Prof.">Prof.</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="grid gap-1.5 sm:col-span-6">
										<Label htmlFor={givenNameId}>First Name *</Label>
										<Input
											id={givenNameId}
											{...memberForm.register("given_name")}
											aria-invalid={!!errors.given_name}
											required
										/>
										{errors.given_name?.message && (
											<p className="text-xs text-destructive">
												{errors.given_name.message}
											</p>
										)}
									</div>
									<div className="grid gap-1.5 sm:col-span-6">
										<Label htmlFor={surnameId}>Last Name *</Label>
										<Input
											id={surnameId}
											{...memberForm.register("surname")}
											aria-invalid={!!errors.surname}
											required
										/>
										{errors.surname?.message && (
											<p className="text-xs text-destructive">
												{errors.surname.message}
											</p>
										)}
									</div>

									<div className="grid gap-1.5 sm:col-span-8">
										<Label htmlFor={emailId}>Email</Label>
										<Input
											id={emailId}
											type="email"
											value={memberData?.email || user.email || ""}
											disabled
											readOnly
										/>
										<p className="text-xs text-muted-foreground">
											Managed by your account login
										</p>
									</div>
									<div className="grid gap-1.5 sm:col-span-4">
										<Label htmlFor={dobId}>Date of Birth</Label>
										<Input
											id={dobId}
											type="date"
											{...memberForm.register("date_of_birth")}
											aria-invalid={!!errors.date_of_birth}
										/>
										{errors.date_of_birth?.message && (
											<p className="text-xs text-destructive">
												{errors.date_of_birth.message}
											</p>
										)}
									</div>

									<div className="sm:col-span-12">
										<p className="mt-2 mb-2 text-sm font-medium text-muted-foreground">
											Address
										</p>
									</div>

									<div className="grid gap-1.5 sm:col-span-9">
										<Label htmlFor={streetId}>Street</Label>
										<Input
											id={streetId}
											{...memberForm.register("street")}
											aria-invalid={!!errors.street}
										/>
										{errors.street?.message && (
											<p className="text-xs text-destructive">
												{errors.street.message}
											</p>
										)}
									</div>
									<div className="grid gap-1.5 sm:col-span-3">
										<Label htmlFor={numberId}>Number</Label>
										<Input
											id={numberId}
											{...memberForm.register("number")}
											aria-invalid={!!errors.number}
										/>
										{errors.number?.message && (
											<p className="text-xs text-destructive">
												{errors.number.message}
											</p>
										)}
									</div>

									<div className="grid gap-1.5 sm:col-span-4">
										<Label htmlFor={postalCodeId}>Postal Code</Label>
										<Input
											id={postalCodeId}
											{...memberForm.register("postal_code")}
											aria-invalid={!!errors.postal_code}
										/>
										{errors.postal_code?.message && (
											<p className="text-xs text-destructive">
												{errors.postal_code.message}
											</p>
										)}
									</div>
									<div className="grid gap-1.5 sm:col-span-8">
										<Label htmlFor={cityId}>City</Label>
										<Input
											id={cityId}
											{...memberForm.register("city")}
											aria-invalid={!!errors.city}
										/>
										{errors.city?.message && (
											<p className="text-xs text-destructive">
												{errors.city.message}
											</p>
										)}
									</div>

									<div className="grid gap-1.5 sm:col-span-12">
										<Label htmlFor={countryId}>Country</Label>
										<Input
											id={countryId}
											{...memberForm.register("country")}
											aria-invalid={!!errors.country}
										/>
										{errors.country?.message && (
											<p className="text-xs text-destructive">
												{errors.country.message}
											</p>
										)}
									</div>
								</div>
							</CardContent>
						</GlassCard>

						<GlassCard id="tumai" variant="elevated" className="scroll-mt-20">
							<CardContent className="p-6">
								<SectionHeading
									icon={GraduationCap}
									title="TUM.ai profile"
									description="Your batch, department, role, and studies."
								/>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div className="grid gap-1.5">
										<Label htmlFor={batchId}>Batch</Label>
										<Select
											value={toSelectValue(memberForm.watch("batch") || "")}
											onValueChange={(value) =>
												memberForm.setValue("batch", fromSelectValue(value), {
													shouldDirty: true,
												})
											}
										>
											<SelectTrigger
												id={batchId}
												className="w-full"
												aria-label="Batch"
												aria-invalid={!!errors.batch}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={NONE_VALUE}>None</SelectItem>
												{BATCH_OPTIONS.map((batch) => (
													<SelectItem key={batch} value={batch}>
														{batch}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{errors.batch?.message && (
											<p className="text-xs text-destructive">
												{errors.batch.message}
											</p>
										)}
									</div>
									<div className="grid gap-1.5">
										<Label htmlFor={departmentId}>Department</Label>
										{isAdmin ? (
											<Select
												value={toSelectValue(currentDepartment)}
												onValueChange={(rawValue) => {
													const value = fromSelectValue(rawValue);
													memberForm.setValue("department", value, {
														shouldDirty: true,
													});
													if (value !== "Research") {
														memberForm.setValue("research_project_id", "", {
															shouldDirty: true,
														});
													}
												}}
											>
												<SelectTrigger
													id={departmentId}
													className="w-full"
													aria-label="Department"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={NONE_VALUE}>None</SelectItem>
													{DEPARTMENTS.map((department) => (
														<SelectItem key={department} value={department}>
															{department}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										) : (
											<>
												<Input
													id={departmentId}
													value={currentDepartment || "Not set"}
													disabled
													readOnly
												/>
												<p className="text-xs text-muted-foreground">
													Departments are assigned by admins. Request a change
													below.
												</p>
											</>
										)}
									</div>

									<div className="grid gap-1.5">
										<Label htmlFor={roleId}>Role in TUM.ai</Label>
										{isAdmin ? (
											<>
												<Select
													value={currentRole}
													onValueChange={(value) => {
														memberForm.setValue("member_role", value, {
															shouldDirty: true,
														});
														const nextDepartment =
															resolveDepartmentForMemberRole(
																value,
																currentDepartment,
															);
														if (nextDepartment !== currentDepartment) {
															memberForm.setValue(
																"department",
																nextDepartment || "",
																{
																	shouldDirty: true,
																},
															);
														}
														if (nextDepartment !== "Research") {
															memberForm.setValue("research_project_id", "", {
																shouldDirty: true,
															});
														}
													}}
												>
													<SelectTrigger
														id={roleId}
														className="w-full"
														aria-label="Role in TUM.ai"
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{MEMBER_ROLES.map((role) => (
															<SelectItem key={role} value={role}>
																{role}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<p className="text-xs text-muted-foreground">
													Admins manage role assignments.
												</p>
											</>
										) : (
											<>
												<Input
													id={roleId}
													value={currentRole}
													disabled
													readOnly
												/>
												<p className="text-xs text-muted-foreground">
													Roles are assigned by admins
												</p>
											</>
										)}
									</div>
									{isResearchDepartmentSelected && (
										<div className="grid gap-1.5">
											<Label htmlFor={researchProjectId}>
												Research project
											</Label>
											<Select
												value={toSelectValue(researchProjectSelectValue)}
												onValueChange={(value) =>
													memberForm.setValue(
														"research_project_id",
														fromSelectValue(value),
														{ shouldDirty: true },
													)
												}
												disabled={isLoadingResearchProjects}
											>
												<SelectTrigger
													id={researchProjectId}
													className="w-full"
													aria-label="Research project"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={NONE_VALUE}>
														No project selected
													</SelectItem>
													{researchProjectOptions.map((project) => (
														<SelectItem key={project.id} value={project.id}>
															{project.title}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												Pick the research project you are part of.
											</p>
										</div>
									)}
									<EducationFields
										degreeValue={memberForm.watch("degree")}
										schoolValue={memberForm.watch("school")}
										onChange={(values) => {
											memberForm.setValue("degree", values.degree, {
												shouldDirty: true,
											});
											memberForm.setValue("school", values.school, {
												shouldDirty: true,
											});
										}}
									/>
								</div>
							</CardContent>
						</GlassCard>

						<GlassCard id="links" variant="elevated" className="scroll-mt-20">
							<CardContent className="p-6">
								<SectionHeading
									icon={Link}
									title="LinkedIn & location"
									description="This data is visible to other TUM.ai members."
								/>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div className="grid gap-1.5 sm:col-span-2">
										<Label htmlFor={linkedinUrlId}>LinkedIn Profile URL</Label>
										<div className="relative">
											<Input
												id={linkedinUrlId}
												placeholder="https://linkedin.com/in/your-profile"
												{...linkedinForm.register("linkedin_profile_url")}
												aria-invalid={
													!!linkedinForm.formState.errors.linkedin_profile_url
												}
												className={cn(isLinkedinUrlValid && "pr-10")}
											/>
											{isLinkedinUrlValid && (
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													asChild
													className="absolute top-1/2 right-1 -translate-y-1/2 text-brand"
												>
													<a
														href={normalizedLinkedinUrl}
														aria-label="View LinkedIn profile"
														target="_blank"
														rel="noopener noreferrer"
													>
														<Link className="size-4" />
													</a>
												</Button>
											)}
										</div>
										{linkedinForm.formState.errors.linkedin_profile_url
											?.message && (
											<p className="text-xs text-destructive">
												{
													linkedinForm.formState.errors.linkedin_profile_url
														.message
												}
											</p>
										)}
									</div>

									<div className="grid gap-1.5">
										<Label htmlFor={publicLocationId}>Public location</Label>
										<Input
											id={publicLocationId}
											placeholder="Munich, Germany"
											{...linkedinForm.register("public_location")}
										/>
										<p className="text-xs text-muted-foreground">
											Shown on your member profile; separate from your address.
										</p>
									</div>
								</div>
							</CardContent>
						</GlassCard>

						<CvPanel userId={user.id} id="cv" className="scroll-mt-20" />

						{!isAdmin && (
							<GlassCard
								id="requests"
								variant="elevated"
								className="scroll-mt-20"
							>
								<CardContent className="p-6">
									<SectionHeading
										icon={Send}
										title="Request role, department, or status changes"
										description="Send a request to the admin and LnF team for review."
									/>

									<div className="grid grid-cols-1 gap-4">
										<div className="grid gap-1.5">
											<Label htmlFor={requestedRoleId}>Requested role</Label>
											<Select
												value={toSelectValue(requestedRole)}
												onValueChange={(value) =>
													setRequestedRole(fromSelectValue(value))
												}
											>
												<SelectTrigger
													id={requestedRoleId}
													className="w-full"
													aria-label="Requested role"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={NONE_VALUE}>No change</SelectItem>
													{MEMBER_ROLES.map((role) => (
														<SelectItem key={role} value={role}>
															{role}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-1.5">
											<Label htmlFor={requestedDepartmentId}>
												Requested department
											</Label>
											<Select
												value={toSelectValue(requestedDepartment)}
												onValueChange={(value) =>
													setRequestedDepartment(fromSelectValue(value))
												}
											>
												<SelectTrigger
													id={requestedDepartmentId}
													className="w-full"
													aria-label="Requested department"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={NONE_VALUE}>No change</SelectItem>
													{DEPARTMENTS.map((department) => (
														<SelectItem key={department} value={department}>
															{department}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">
												Department changes are reviewed by an admin.
											</p>
										</div>
										<div>
											<div className="flex items-center gap-1">
												<div className="flex items-center gap-2">
													<Checkbox
														id={alumniCheckboxId}
														checked={isRequestingAlumniStatus}
														onCheckedChange={(checked) =>
															setIsRequestingAlumniStatus(checked === true)
														}
													/>
													<Label htmlFor={alumniCheckboxId}>
														Request alumni status
													</Label>
												</div>
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																type="button"
																variant="ghost"
																size="icon-sm"
																aria-label="Alumni status request information"
															>
																<Info className="size-4" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															Alumni requests are eligible after two active
															semesters and are reviewed by Legal & Finance.
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										</div>
										<div className="grid gap-1.5">
											<Label htmlFor={reasonId}>Reason</Label>
											<Textarea
												id={reasonId}
												value={changeRequestReason}
												onChange={(event) =>
													setChangeRequestReason(event.target.value)
												}
												rows={3}
												placeholder="Briefly explain why your role or status should change."
											/>
										</div>
									</div>

									{latestMemberChangeRequest && (
										<div className="mt-5 rounded-lg bg-brand/5 p-4">
											<p className="mb-0.5 text-sm font-medium">
												Latest request:{" "}
												{latestMemberChangeRequest.status
													.charAt(0)
													.toUpperCase() +
													latestMemberChangeRequest.status.slice(1)}
											</p>
											{latestMemberChangeRequest.reason && (
												<p className="text-sm text-muted-foreground">
													Reason: {latestMemberChangeRequest.reason}
												</p>
											)}
										</div>
									)}

									<Button
										type="button"
										variant="outline"
										onClick={handleSubmitMemberChangeRequest}
										disabled={isSubmittingChangeRequest}
										className="mt-5"
									>
										{isSubmittingChangeRequest
											? "Submitting request..."
											: "Request changes"}
									</Button>
								</CardContent>
							</GlassCard>
						)}

						<GlassCard id="banking" variant="elevated" className="scroll-mt-20">
							<CardContent className="p-6">
								<SectionHeading
									icon={Landmark}
									title="Banking & agreements"
									description="Your SEPA details and required agreements."
								/>

								<div className="mb-6 grid gap-4">
									<div className="grid gap-1.5">
										<Label htmlFor={ibanId}>IBAN *</Label>
										<Input
											id={ibanId}
											{...sepaForm.register("iban")}
											aria-invalid={!!sepaForm.formState.errors.iban}
											className="font-mono"
											required
										/>
										{sepaForm.formState.errors.iban?.message && (
											<p className="text-xs text-destructive">
												{sepaForm.formState.errors.iban.message}
											</p>
										)}
									</div>
									<div className="grid gap-1.5">
										<Label htmlFor={bicId}>BIC</Label>
										<Input id={bicId} {...sepaForm.register("bic")} />
									</div>
									<div className="grid gap-1.5">
										<Label htmlFor={bankNameId}>Bank Name *</Label>
										<Input
											id={bankNameId}
											{...sepaForm.register("bank_name")}
											aria-invalid={!!sepaForm.formState.errors.bank_name}
											required
										/>
										{sepaForm.formState.errors.bank_name?.message && (
											<p className="text-xs text-destructive">
												{sepaForm.formState.errors.bank_name.message}
											</p>
										)}
									</div>
								</div>

								<div className="space-y-3">
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${fieldId}-mandate`}
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
										<Label
											htmlFor={`${fieldId}-mandate`}
											className="font-normal"
										>
											<span className="text-sm">
												I agree to the{" "}
												<button
													type="button"
													onClick={(e) => {
														e.preventDefault();
														e.stopPropagation();
														openSepaModal();
													}}
													className="cursor-pointer text-brand hover:underline"
												>
													SEPA mandate
												</button>
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
											id={`${fieldId}-privacy`}
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
										<Label
											htmlFor={`${fieldId}-privacy`}
											className="font-normal"
										>
											<span className="text-sm">
												I agree to the{" "}
												<button
													type="button"
													onClick={(e) => {
														e.preventDefault();
														e.stopPropagation();
														openPrivacyModal();
													}}
													className="cursor-pointer text-brand hover:underline"
												>
													Privacy Policy
												</button>{" "}
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
											id={`${fieldId}-data-privacy`}
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
										<Label
											htmlFor={`${fieldId}-data-privacy`}
											className="font-normal"
										>
											<span className="text-sm">
												I agree to the{" "}
												<button
													type="button"
													onClick={(e) => {
														e.preventDefault();
														e.stopPropagation();
														openDataPrivacyNoticeModal();
													}}
													className="cursor-pointer text-brand hover:underline"
												>
													Data Privacy Notice
												</button>{" "}
												*
											</span>
										</Label>
									</div>
									{sepaForm.formState.errors.data_privacy_notice_agreed && (
										<p className="block text-xs text-destructive">
											{
												sepaForm.formState.errors.data_privacy_notice_agreed
													.message
											}
										</p>
									)}
								</div>
							</CardContent>
						</GlassCard>

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
		</div>
	);
}
