import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminMemberDoorPinState } from "@/features/admin/hooks/useAdminMemberDoorPin";

const NEW_PIN_INPUT_ID = "edit-door-pin";
const NEW_PIN_HINT_ID = "edit-door-pin-hint";

/**
 * Door PIN controls in the admin member editor: reveal the current PIN, set a
 * new one, or clear it. Saved immediately, independent of "Save member
 * changes".
 */
export function AdminMemberDoorPinField({
	doorPin,
	isRevealed,
	isLoadingPin,
	hasLoadError,
	toggleRevealed,
	draftPin,
	setDraftPin,
	draftError,
	canSavePin,
	isSavingPin,
	savePin,
	isConfirmingClear,
	requestClear,
	cancelClear,
	clearPin,
	isClearingPin,
}: AdminMemberDoorPinState) {
	return (
		<section aria-labelledby="edit-door-pin-heading" className="grid gap-3">
			<h3
				id="edit-door-pin-heading"
				className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
			>
				<KeyRound className="size-4 text-brand" aria-hidden="true" />
				Door PIN
			</h3>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={toggleRevealed}
					aria-pressed={isRevealed}
				>
					{isRevealed ? (
						<EyeOff className="size-4" aria-hidden="true" />
					) : (
						<Eye className="size-4" aria-hidden="true" />
					)}
					{isRevealed ? "Hide current PIN" : "Show current PIN"}
				</Button>
				{isRevealed && (
					<output aria-live="polite" className="text-sm">
						{isLoadingPin ? (
							<span className="text-muted-foreground">Loading…</span>
						) : hasLoadError ? (
							<span className="text-destructive">
								The PIN couldn't be loaded.
							</span>
						) : doorPin?.status === "available" ? (
							<span className="font-mono text-base tracking-[0.25em]">
								{doorPin.pin}
							</span>
						) : (
							<span className="text-muted-foreground">No PIN assigned.</span>
						)}
					</output>
				)}
			</div>

			<div className="grid gap-1.5">
				<Label htmlFor={NEW_PIN_INPUT_ID}>New PIN</Label>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						id={NEW_PIN_INPUT_ID}
						inputMode="numeric"
						autoComplete="off"
						placeholder="4 to 10 digits"
						value={draftPin}
						onChange={(event) => setDraftPin(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								void savePin();
							}
						}}
						aria-invalid={Boolean(draftError)}
						aria-describedby={NEW_PIN_HINT_ID}
						className="font-mono sm:max-w-48"
					/>
					<Button
						type="button"
						variant="outline"
						onClick={() => void savePin()}
						disabled={!canSavePin}
					>
						{isSavingPin ? "Saving..." : "Save PIN"}
					</Button>
				</div>
				<p
					id={NEW_PIN_HINT_ID}
					className={
						draftError
							? "text-xs text-destructive"
							: "text-xs text-muted-foreground"
					}
				>
					{draftError ??
						"Saved right away. Must match the PIN in the key cabinet and be unique."}
				</p>
			</div>

			{isConfirmingClear ? (
				<InfoBox
					variant="destructive"
					className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
				>
					<p>Clear this member's door PIN? They'll no longer see it.</p>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={cancelClear}
							disabled={isClearingPin}
						>
							Keep PIN
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => void clearPin()}
							disabled={isClearingPin}
						>
							{isClearingPin ? "Clearing..." : "Clear PIN"}
						</Button>
					</div>
				</InfoBox>
			) : (
				<div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-destructive"
						onClick={requestClear}
					>
						Clear PIN
					</Button>
				</div>
			)}
		</section>
	);
}
