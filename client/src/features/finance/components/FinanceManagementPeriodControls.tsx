import type { FinancePeriodType } from "@member-manager/shared";
import type { ReactElement } from "react";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import {
	formatFinancePeriodLabel,
	listFinancePeriodKeys,
} from "@/features/finance/financeUtils";

interface FinanceManagementPeriodControlsProps {
	idPrefix: string;
	period: FinancePeriod;
	onPeriodTypeChange: (type: FinancePeriodType) => void;
	onPeriodKeyChange: (key: string) => void;
}

export function FinanceManagementPeriodControls({
	idPrefix,
	period,
	onPeriodTypeChange,
	onPeriodKeyChange,
}: FinanceManagementPeriodControlsProps): ReactElement {
	return (
		<div className="flex flex-wrap items-end gap-3 print:hidden">
			<div className="grid gap-1.5">
				<Label htmlFor={`${idPrefix}-period-type`}>Zeitraumtyp</Label>
				<Select
					value={period.type}
					onValueChange={(value) =>
						onPeriodTypeChange(value as FinancePeriodType)
					}
				>
					<SelectTrigger
						id={`${idPrefix}-period-type`}
						className="w-40"
						aria-label="Zeitraumtyp"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="year">Jahr</SelectItem>
						<SelectItem value="semester">Semester</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`${idPrefix}-period-key`}>Zeitraum</Label>
				<Select value={period.key} onValueChange={onPeriodKeyChange}>
					<SelectTrigger
						id={`${idPrefix}-period-key`}
						className="w-48"
						aria-label="Zeitraum"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{listFinancePeriodKeys(period.type).map((key) => (
							<SelectItem key={key} value={key}>
								{formatFinancePeriodLabel({ type: period.type, key })}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
