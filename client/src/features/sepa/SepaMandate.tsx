// SEPA Mandate Agreement - MUI styled version
import {
	Box,
	Checkbox,
	Divider,
	FormControlLabel,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

interface SepaMandateProps {
	onCheckChange?: (checked: boolean) => void;
	sepaAgreed: boolean;
}

export default function SepaMandate({
	onCheckChange,
	sepaAgreed,
}: SepaMandateProps) {
	const [checked, setChecked] = useState(!!sepaAgreed);

	useEffect(() => {
		setChecked(!!sepaAgreed);
	}, [sepaAgreed]);

	useEffect(() => {
		onCheckChange?.(checked);
	}, [checked, onCheckChange]);

	return (
		<Box>
			<Box sx={{ maxHeight: "55vh", overflowY: "auto", pr: 1 }}>
				<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
					Issuance of a Direct Debit Authorization and a SEPA Direct Debit
					Mandate
				</Typography>

				<Box sx={{ mb: 3 }}>
					<Typography variant="subtitle2" color="text.secondary" gutterBottom>
						Name of the Payee
					</Typography>
					<Typography>TUM.ai e.V.</Typography>
				</Box>

				<Box sx={{ mb: 3 }}>
					<Typography variant="subtitle2" color="text.secondary" gutterBottom>
						Address of the Payee
					</Typography>
					<Typography>
						TUM.ai e.V.
						<br />
						Arcisstraße 21
						<br />
						80333 Munich, Germany
					</Typography>
				</Box>

				<Box sx={{ mb: 3 }}>
					<Typography variant="subtitle2" color="text.secondary" gutterBottom>
						Creditor Identifier
					</Typography>
					<Typography sx={{ fontFamily: "monospace" }}>DEXXXXXXXXXX</Typography>
				</Box>

				<Box sx={{ mb: 3 }}>
					<Typography variant="subtitle2" color="text.secondary" gutterBottom>
						Due Dates for Membership Fees
					</Typography>
					<Typography>
						According to Section X No. X of our Contribution Rules, membership
						fees for active members are due on{" "}
						<Typography component="span" sx={{ fontStyle: "italic" }}>
							XX.XX.XXXX
						</Typography>{" "}
						for the summer semester and on{" "}
						<Typography component="span" sx={{ fontStyle: "italic" }}>
							XX.XX.XXXX
						</Typography>{" "}
						for the winter semester each year.
					</Typography>
				</Box>

				<Divider sx={{ my: 3 }} />

				<Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
					Direct Debit Authorization
				</Typography>
				<Typography sx={{ mb: 3 }}>
					I authorize the payee <strong>TUM.ai</strong>, revocably, to collect
					payments due from me by direct debit from my account upon the due
					date.
				</Typography>

				<Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
					SEPA Direct Debit Mandate
				</Typography>
				<Typography sx={{ mb: 3 }}>
					(A) I authorize the payee <strong>TUM.ai</strong> to collect payments
					from my account via SEPA direct debit.
					<br />
					(B) At the same time, I instruct my bank to honor the SEPA direct
					debits drawn by <strong>TUM.ai</strong> on my account.
				</Typography>

				<Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
					Note
				</Typography>
				<Typography sx={{ mb: 2 }}>
					I may request a refund of the debited amount within eight weeks,
					starting from the debit date. The conditions agreed upon with my bank
					apply.
				</Typography>
				<Typography sx={{ mb: 3 }}>
					<strong>TUM.ai</strong> will inform me of the SEPA Core Direct Debit
					collection in this procedure at least 14 days before the debit takes
					place.
				</Typography>
			</Box>

			<Divider sx={{ my: 2 }} />

			<FormControlLabel
				control={
					<Checkbox
						checked={checked}
						onChange={(e) => setChecked(e.target.checked)}
					/>
				}
				label={
					<Typography variant="body2">
						I have read and agree to the SEPA mandate.
					</Typography>
				}
			/>
		</Box>
	);
}
