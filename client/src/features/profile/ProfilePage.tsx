import { zodResolver } from "@hookform/resolvers/zod";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SaveIcon from "@mui/icons-material/Save";
import {
	Box,
	Button,
	CardContent,
	Checkbox,
	Chip,
	CircularProgress,
	FormControlLabel,
	Grid,
	MenuItem,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useMemberData } from "../../hooks/useMemberData";
import { useSepaData } from "../../hooks/useSepaData";
import {
	type MemberSchema,
	memberSchema,
	type SepaSchema,
	sepaSchema,
} from "../../lib/schemas";
import PrivacyPolicy from "../legal/PrivacyPolicy";
import SepaMandate from "../sepa/SepaMandate";

interface ProfilePageProps {
	user: User;
}

export default function ProfilePage({ user }: ProfilePageProps) {
	const theme = useTheme();
	const { showToast } = useToast();
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(user.id);

	const {
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: isUpdatingSepa,
	} = useSepaData(user.id);

	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: {
			active: true,
			salutation: "",
			title: "",
			surname: "",
			given_name: "",
			email: user.email || "",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "Germany",
			user_id: user.id,
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
			user_id: user.id,
		},
	});

	const mandateAgreed = sepaForm.watch("mandate_agreed");
	const privacyAgreed = sepaForm.watch("privacy_agreed");
	const isActive = memberForm.watch("active");

	useEffect(() => {
		if (memberData) {
			memberForm.reset({
				active: memberData.active,
				salutation: memberData.salutation || "",
				title: memberData.title || "",
				surname: memberData.surname || "",
				given_name: memberData.given_name || "",
				email: memberData.email || "",
				date_of_birth: memberData.date_of_birth || "",
				street: memberData.street || "",
				number: memberData.number || "",
				postal_code: memberData.postal_code || "",
				city: memberData.city || "",
				country: memberData.country || "Germany",
				user_id: user.id,
			});
		}
	}, [memberData, memberForm, user.id]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset({
				iban: sepaData.iban || "",
				bic: sepaData.bic || "",
				bank_name: sepaData.bank_name || "",
				mandate_agreed: sepaData.mandate_agreed || false,
				privacy_agreed: sepaData.privacy_agreed || false,
				user_id: user.id,
			});
		}
	}, [sepaData, sepaForm, user.id]);

	const onSubmit = async () => {
		try {
			const memberValid = await memberForm.trigger();
			const sepaValid = await sepaForm.trigger();

			const promises = [];
			if (memberValid) {
				promises.push(updateMemberAsync(memberForm.getValues()));
			}
			if (sepaValid) {
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

	const isLoading = isLoadingMember || isLoadingSepa;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "60vh",
					gap: 2,
				}}
			>
				<CircularProgress size={24} />
				<Typography color="text.secondary">Loading profile...</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ py: 2 }}>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					mb: 4,
				}}
			>
				<Box>
					<Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
						Your Profile
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Manage your personal information and agreements
					</Typography>
				</Box>
				<Chip
					icon={
						isActive ? (
							<CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
						) : (
							<ErrorOutlineIcon sx={{ fontSize: 18 }} />
						)
					}
					label={isActive ? "Active Member" : "Inactive"}
					color={isActive ? "success" : "default"}
					variant="outlined"
				/>
			</Box>

			<form onSubmit={memberForm.handleSubmit(onSubmit)}>
				<Grid container spacing={3}>
					<Grid size={{ xs: 12, lg: 7 }}>
						<GlassCard>
							<CardContent sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
									Personal Information
								</Typography>

								<Grid container spacing={2}>
									<Grid size={{ xs: 12, sm: 4 }}>
										<TextField
											select
											label="Salutation"
											{...memberForm.register("salutation")}
											value={memberForm.watch("salutation")}
											error={!!memberForm.formState.errors.salutation}
											helperText={
												memberForm.formState.errors.salutation?.message
											}
										>
											<MenuItem value="">Select...</MenuItem>
											<MenuItem value="Mr.">Mr.</MenuItem>
											<MenuItem value="Ms.">Ms.</MenuItem>
											<MenuItem value="Mx.">Mx.</MenuItem>
										</TextField>
									</Grid>
									<Grid size={{ xs: 12, sm: 8 }}>
										<TextField
											select
											label="Title"
											{...memberForm.register("title")}
											value={memberForm.watch("title")}
										>
											<MenuItem value="">None</MenuItem>
											<MenuItem value="Dr.">Dr.</MenuItem>
											<MenuItem value="Prof.">Prof.</MenuItem>
										</TextField>
									</Grid>

									<Grid size={{ xs: 12, sm: 6 }}>
										<TextField
											label="First Name"
											{...memberForm.register("given_name")}
											error={!!memberForm.formState.errors.given_name}
											helperText={
												memberForm.formState.errors.given_name?.message
											}
											required
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										<TextField
											label="Last Name"
											{...memberForm.register("surname")}
											error={!!memberForm.formState.errors.surname}
											helperText={memberForm.formState.errors.surname?.message}
											required
										/>
									</Grid>

									<Grid size={{ xs: 12, sm: 8 }}>
										<TextField
											label="Email"
											type="email"
											{...memberForm.register("email")}
											error={!!memberForm.formState.errors.email}
											helperText={memberForm.formState.errors.email?.message}
											required
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 4 }}>
										<TextField
											label="Date of Birth"
											type="date"
											{...memberForm.register("date_of_birth")}
											slotProps={{ inputLabel: { shrink: true } }}
											error={!!memberForm.formState.errors.date_of_birth}
											helperText={
												memberForm.formState.errors.date_of_birth?.message
											}
											required
										/>
									</Grid>

									<Grid size={12}>
										<Typography
											variant="subtitle2"
											color="text.secondary"
											sx={{ mt: 1, mb: 1 }}
										>
											Address
										</Typography>
									</Grid>

									<Grid size={{ xs: 12, sm: 9 }}>
										<TextField
											label="Street"
											{...memberForm.register("street")}
											error={!!memberForm.formState.errors.street}
											helperText={memberForm.formState.errors.street?.message}
											required
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 3 }}>
										<TextField
											label="Number"
											{...memberForm.register("number")}
											error={!!memberForm.formState.errors.number}
											helperText={memberForm.formState.errors.number?.message}
											required
										/>
									</Grid>

									<Grid size={{ xs: 12, sm: 4 }}>
										<TextField
											label="Postal Code"
											{...memberForm.register("postal_code")}
											error={!!memberForm.formState.errors.postal_code}
											helperText={
												memberForm.formState.errors.postal_code?.message
											}
											required
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 8 }}>
										<TextField
											label="City"
											{...memberForm.register("city")}
											error={!!memberForm.formState.errors.city}
											helperText={memberForm.formState.errors.city?.message}
											required
										/>
									</Grid>

									<Grid size={12}>
										<TextField
											label="Country"
											{...memberForm.register("country")}
											error={!!memberForm.formState.errors.country}
											helperText={memberForm.formState.errors.country?.message}
											required
										/>
									</Grid>
								</Grid>
							</CardContent>
						</GlassCard>
					</Grid>

					<Grid size={{ xs: 12, lg: 5 }}>
						<GlassCard>
							<CardContent sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
									Banking & Agreements
								</Typography>

								<Box sx={{ mb: 3 }}>
									<TextField
										label="IBAN"
										{...sepaForm.register("iban")}
										error={!!sepaForm.formState.errors.iban}
										helperText={sepaForm.formState.errors.iban?.message}
										sx={{ mb: 2, fontFamily: "monospace" }}
										required
									/>
									<TextField
										label="BIC"
										{...sepaForm.register("bic")}
										sx={{ mb: 2 }}
									/>
									<TextField
										label="Bank Name"
										{...sepaForm.register("bank_name")}
										error={!!sepaForm.formState.errors.bank_name}
										helperText={sepaForm.formState.errors.bank_name?.message}
										required
									/>
								</Box>

								<Box
									sx={{
										p: 2,
										borderRadius: 2,
										backgroundColor: "rgba(255, 255, 255, 0.03)",
										border: `1px solid ${theme.palette.divider}`,
									}}
								>
									<FormControlLabel
										control={
											<Checkbox
												checked={mandateAgreed}
												onChange={(e) => {
													if (!mandateAgreed && e.target.checked) {
														setShowSepaModal(true);
													}
													sepaForm.setValue(
														"mandate_agreed",
														e.target.checked,
														{
															shouldDirty: true,
														},
													);
												}}
											/>
										}
										label={
											<Typography variant="body2">
												I agree to the{" "}
												<Box
													component="span"
													onClick={(e) => {
														e.preventDefault();
														setShowSepaModal(true);
													}}
													sx={{
														color: theme.palette.primary.main,
														cursor: "pointer",
														"&:hover": { textDecoration: "underline" },
													}}
												>
													SEPA mandate
												</Box>
											</Typography>
										}
										sx={{ mb: 1 }}
									/>

									<FormControlLabel
										control={
											<Checkbox
												checked={privacyAgreed}
												onChange={(e) => {
													if (!privacyAgreed && e.target.checked) {
														setShowPrivacyModal(true);
													}
													sepaForm.setValue(
														"privacy_agreed",
														e.target.checked,
														{
															shouldDirty: true,
														},
													);
												}}
											/>
										}
										label={
											<Typography variant="body2">
												I agree to the{" "}
												<Box
													component="span"
													onClick={(e) => {
														e.preventDefault();
														setShowPrivacyModal(true);
													}}
													sx={{
														color: theme.palette.primary.main,
														cursor: "pointer",
														"&:hover": { textDecoration: "underline" },
													}}
												>
													Privacy Policy
												</Box>{" "}
												*
											</Typography>
										}
									/>
								</Box>
							</CardContent>
						</GlassCard>

						<Button
							type="submit"
							variant="contained"
							size="large"
							fullWidth
							disabled={isUpdating}
							startIcon={
								isUpdating ? (
									<CircularProgress size={20} color="inherit" />
								) : (
									<SaveIcon />
								)
							}
							sx={{ mt: 3, py: 1.5 }}
						>
							{isUpdating ? "Saving..." : "Save Changes"}
						</Button>
					</Grid>
				</Grid>
			</form>

			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={() => setShowSepaModal(false)}
					confirmDisabled={!mandateAgreed}
					onConfirm={() => {
						sepaForm.setValue("mandate_agreed", true, { shouldDirty: true });
						setShowSepaModal(false);
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
					onClose={() => setShowPrivacyModal(false)}
					confirmDisabled={!privacyAgreed}
					onConfirm={() => {
						sepaForm.setValue("privacy_agreed", true, { shouldDirty: true });
						setShowPrivacyModal(false);
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
		</Box>
	);
}
