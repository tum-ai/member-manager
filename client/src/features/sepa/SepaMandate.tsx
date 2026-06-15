// SEPA Mandate Agreement - shadcn styled version
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
		<div>
			<div className="max-h-[55vh] overflow-y-auto pr-1">
				<h2 className="mb-4 text-lg font-semibold">
					Issuance of a Direct Debit Authorization and a SEPA Direct Debit
					Mandate
				</h2>

				<div className="mb-6">
					<p className="mb-1 text-sm font-medium text-muted-foreground">
						Name of the Payee
					</p>
					<p>TUM.ai e.V.</p>
				</div>

				<div className="mb-6">
					<p className="mb-1 text-sm font-medium text-muted-foreground">
						Address of the Payee
					</p>
					<p>
						TUM.ai e.V.
						<br />
						Arcisstraße 21
						<br />
						80333 Munich, Germany
					</p>
				</div>

				<div className="mb-6">
					<p className="mb-1 text-sm font-medium text-muted-foreground">
						Creditor Identifier
					</p>
					<p className="font-mono">DE49ZZZ00002729637</p>
				</div>

				<div className="mb-6">
					<p className="mb-1 text-sm font-medium text-muted-foreground">
						Due Dates for Membership Fees
					</p>
					<p>
						According to Section 7.2. of our Contribution Rules, membership fees
						for active members are due on 01.04. for the summer semester and on
						01.10. for the winter semester each year.
					</p>
				</div>

				<Separator className="my-6" />

				<h3 className="mb-2 font-semibold">Direct Debit Authorization</h3>
				<p className="mb-6">
					I authorize the payee <strong>TUM.ai</strong>, revocably, to collect
					payments due from me by direct debit from my account upon the due
					date.
				</p>

				<h3 className="mb-2 font-semibold">SEPA Direct Debit Mandate</h3>
				<p className="mb-6">
					(A) I authorize the payee <strong>TUM.ai</strong> to collect payments
					from my account via SEPA direct debit.
					<br />
					(B) At the same time, I instruct my bank to honor the SEPA direct
					debits drawn by <strong>TUM.ai</strong> on my account.
				</p>

				<h3 className="mb-2 font-semibold">Note</h3>
				<p className="mb-4">
					I may request a refund of the debited amount within eight weeks,
					starting from the debit date. The conditions agreed upon with my bank
					apply.
				</p>
				<p className="mb-6">
					<strong>TUM.ai</strong> will inform me of the SEPA Core Direct Debit
					collection in this procedure at least 14 days before the debit takes
					place.
				</p>
			</div>

			<Separator className="my-4" />

			<div className="flex items-center gap-2">
				<Checkbox
					id="sepa-agree"
					checked={checked}
					onCheckedChange={(value) => setChecked(value === true)}
				/>
				<Label htmlFor="sepa-agree" className="text-sm font-normal">
					I have read and agree to the SEPA mandate.
				</Label>
			</div>
		</div>
	);
}
