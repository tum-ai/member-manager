import type { ReactElement } from "react";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ALL_VALUE } from "@/features/admin/adminDatabaseViewTypes";

interface FilterSelectProps {
	className?: string;
	label: string;
	value: string;
	onValueChange: (value: string) => void;
	options: ReadonlyArray<{ label: string; value: string }>;
}

export function FilterSelect({
	className,
	label,
	value,
	onValueChange,
	options,
}: FilterSelectProps): ReactElement {
	const selectedLabel =
		options.find((option) => option.value === value)?.label ?? "All";
	return (
		<div className={className}>
			<div className="grid gap-1.5">
				<Label>{label}</Label>
				<Select
					value={value || ALL_VALUE}
					onValueChange={(next) =>
						onValueChange(next === ALL_VALUE ? "" : next)
					}
				>
					<SelectTrigger aria-label={label} className="w-full">
						<SelectValue>{selectedLabel}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem
								key={option.value || ALL_VALUE}
								value={option.value || ALL_VALUE}
							>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
