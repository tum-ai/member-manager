import {
	cleanIbanInput,
	formatIban,
	IBAN_MAX_LENGTH,
	isValidIban,
} from "@member-manager/shared";
import { Check } from "lucide-react";
import type React from "react";
import {
	type ReactElement,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { Input } from "@/components/ui/input";

export const IBAN_PLACEHOLDER = "DE89 3704 0044 0532 0130 00";
export const IBAN_VALID_HINT = "Valid IBAN";
export const IBAN_INVALID_HINT = "This IBAN isn't valid. Check for typos.";

export interface IbanInputProps
	extends Omit<
		React.ComponentProps<"input">,
		"value" | "defaultValue" | "onChange" | "type" | "children" | "ref"
	> {
	/** Required: the validity hint below the field is wired up via `${id}-hint`. */
	id: string;
	/** Current IBAN in any spacing or case; it is always shown grouped. */
	value: string;
	/** Receives the cleaned electronic form (uppercase, no separators). */
	onValueChange: (value: string) => void;
	/** External error (e.g. from submit validation); replaces the built-in hint. */
	error?: string;
}

/** Caret offset in the grouped display right after the `count`-th IBAN character. */
function displayOffsetAfter(count: number): number {
	return count <= 0 ? 0 : count + Math.floor((count - 1) / 4);
}

/**
 * Text field for IBANs. Shows the value in blocks of four while reporting
 * only the cleaned electronic form to the parent, so callers store and
 * validate one canonical string. Keeps the caret where the user is editing
 * when the regrouping shifts characters, strips an "IBAN:" label and stray
 * punctuation on paste, and turns off the mobile keyboard's autocorrect and
 * lowercase-first behaviour.
 *
 * The validity hint rewards early and flags late: "Valid IBAN" appears as
 * soon as the checksum passes, but an invalid value is only flagged after
 * the field loses focus or receives a paste, so a half-typed IBAN isn't
 * reported as wrong. The label stays with the caller (`<Label htmlFor={id}>`).
 */
export function IbanInput({
	id,
	value,
	onValueChange,
	error,
	className,
	placeholder = IBAN_PLACEHOLDER,
	onBlur,
	onFocus,
	onPaste,
	"aria-describedby": ariaDescribedBy,
	...inputProps
}: IbanInputProps): ReactElement {
	const inputRef = useRef<HTMLInputElement>(null);
	const pendingCaret = useRef<number | null>(null);
	// Guarantees a commit (and so the caret effect) even when the parent keeps
	// the same value, e.g. after a keystroke that cleaning discards.
	const [, forceRender] = useReducer((count: number) => count + 1, 0);
	const [isFocused, setIsFocused] = useState(false);
	const [validateEagerly, setValidateEagerly] = useState(false);

	const iban = cleanIbanInput(value);
	const displayValue = formatIban(iban);
	const isValid = iban !== "" && isValidIban(iban);
	const showInvalid =
		iban !== "" && !isValid && (validateEagerly || !isFocused);
	const hasError = Boolean(error) || showInvalid;
	const hint = error ?? (showInvalid ? IBAN_INVALID_HINT : undefined);
	const hintId = `${id}-hint`;
	const describedBy =
		[ariaDescribedBy, hint || isValid ? hintId : undefined]
			.filter(Boolean)
			.join(" ") || undefined;

	useLayoutEffect(() => {
		const caret = pendingCaret.current;
		pendingCaret.current = null;
		const input = inputRef.current;
		if (caret === null || !input || document.activeElement !== input) {
			return;
		}
		input.setSelectionRange(caret, caret);
	});

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
		const raw = event.target.value;
		const caret = event.target.selectionStart ?? raw.length;
		let next = cleanIbanInput(raw);
		let charsBeforeCaret = cleanIbanInput(raw.slice(0, caret)).length;

		// Deleting one of the display-only spaces leaves the IBAN unchanged, and
		// the regrouping would put the space straight back. Delete the character
		// on the far side of it instead, like a plain text field would.
		if (next === iban && raw.length < displayValue.length) {
			const { inputType } = event.nativeEvent as InputEvent;
			if (inputType === "deleteContentForward") {
				next =
					next.slice(0, charsBeforeCaret) + next.slice(charsBeforeCaret + 1);
			} else if (charsBeforeCaret > 0) {
				next =
					next.slice(0, charsBeforeCaret - 1) + next.slice(charsBeforeCaret);
				charsBeforeCaret -= 1;
			}
		}

		next = next.slice(0, IBAN_MAX_LENGTH);
		if (next === "") {
			setValidateEagerly(false);
		}
		pendingCaret.current = displayOffsetAfter(
			Math.min(charsBeforeCaret, next.length),
		);
		forceRender();
		onValueChange(next);
	};

	return (
		<div className="min-w-0">
			<Input
				autoCapitalize="characters"
				autoComplete="off"
				autoCorrect="off"
				inputMode="text"
				spellCheck={false}
				placeholder={placeholder}
				{...inputProps}
				ref={inputRef}
				id={id}
				type="text"
				value={displayValue}
				onChange={handleChange}
				onFocus={(event) => {
					setIsFocused(true);
					onFocus?.(event);
				}}
				onBlur={(event) => {
					setIsFocused(false);
					if (iban !== "") {
						setValidateEagerly(true);
					}
					onBlur?.(event);
				}}
				onPaste={(event) => {
					setValidateEagerly(true);
					onPaste?.(event);
				}}
				aria-invalid={hasError}
				aria-describedby={describedBy}
				className={className}
			/>
			<div id={hintId} aria-live="polite">
				{hint ? (
					<p className="mt-1.5 text-xs text-destructive">{hint}</p>
				) : isValid ? (
					<p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
						<Check aria-hidden="true" className="size-3.5 shrink-0" />
						{IBAN_VALID_HINT}
					</p>
				) : null}
			</div>
		</div>
	);
}
