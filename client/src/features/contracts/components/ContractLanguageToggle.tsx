import type { ContractLanguage } from "@member-manager/shared";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ContractLanguageToggleProps {
	value: ContractLanguage;
	/** False while a template has no English body text yet. */
	englishAvailable: boolean;
	disabled?: boolean;
	onChange: (language: ContractLanguage) => void;
}

/**
 * Picks the language a contract is created in. English stays disabled until the
 * selected template has an English body text, because the renderer would
 * otherwise silently fall back to German.
 */
export function ContractLanguageToggle({
	value,
	englishAvailable,
	disabled = false,
	onChange,
}: ContractLanguageToggleProps): JSX.Element {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor="contract-language">Contract language</Label>
			<ToggleGroup
				id="contract-language"
				type="single"
				variant="outline"
				value={value}
				aria-label="Contract language"
				onValueChange={(next) => {
					// Radix clears the value when the active item is pressed again.
					if (next === "de" || next === "en") onChange(next);
				}}
			>
				<ToggleGroupItem value="de" disabled={disabled}>
					Deutsch
				</ToggleGroupItem>
				<ToggleGroupItem value="en" disabled={disabled || !englishAvailable}>
					English
				</ToggleGroupItem>
			</ToggleGroup>
			{englishAvailable ? null : (
				<p className="text-xs text-muted-foreground">
					This template is only available in German.
				</p>
			)}
		</div>
	);
}
