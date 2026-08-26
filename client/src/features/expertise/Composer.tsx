import { ArrowUp, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { searchPeople } from "./hooks/useExpertiseSearch";
import type { ComposerMention, PersonSuggestion } from "./types";

interface ComposerProps {
	onSubmit: (text: string, mentions: ComposerMention[]) => void;
	disabled?: boolean;
	autoFocus?: boolean;
}

const MENTION_TRIGGER = /@([\p{L}\p{N}_]*)$/u;

function initialsOf(name: string): string {
	return (
		name
			.split(/\s+/)
			.map((part) => part.charAt(0))
			.join("")
			.slice(0, 2)
			.toUpperCase() || "?"
	);
}

/** Accessible prompt composer with a keyboard-operated member mention picker. */
export function Composer({
	onSubmit,
	disabled,
	autoFocus,
}: ComposerProps): JSX.Element {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const listboxId = useId();
	const suggestionStatusId = useId();
	const [value, setValue] = useState("");
	const [mentions, setMentions] = useState<ComposerMention[]>([]);
	const [query, setQuery] = useState<string | null>(null);
	const [suggestions, setSuggestions] = useState<PersonSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		if (autoFocus) inputRef.current?.focus();
	}, [autoFocus]);

	useEffect(() => {
		if (query === null || query.length < 2) {
			setSuggestions([]);
			setSearchError(null);
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setSearchError(null);
		const timeout = window.setTimeout(async () => {
			try {
				const people = await searchPeople(query);
				if (!cancelled) {
					setSuggestions(people);
					setActiveIndex(0);
				}
			} catch (error) {
				if (!cancelled) {
					setSuggestions([]);
					setSearchError(
						error instanceof Error ? error.message : "Could not search members",
					);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}, 160);
		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	}, [query]);

	const updateTrigger = (text: string, caret: number) => {
		const match = MENTION_TRIGGER.exec(text.slice(0, caret));
		setQuery(match?.[1] ?? null);
	};

	const pick = (person: PersonSuggestion) => {
		const caret = inputRef.current?.selectionStart ?? value.length;
		const before = value
			.slice(0, caret)
			.replace(MENTION_TRIGGER, `@${person.name} `);
		setValue(before + value.slice(caret));
		setMentions((current) =>
			current.some((mention) => mention.user_id === person.user_id)
				? current
				: [...current, { user_id: person.user_id, label: person.name }],
		);
		setQuery(null);
		setSuggestions([]);
		setSearchError(null);
		inputRef.current?.focus();
	};

	const submit = () => {
		const text = value.trim();
		if (!text || disabled) return;
		onSubmit(
			text,
			mentions.filter((mention) => text.includes(`@${mention.label}`)),
		);
		setValue("");
		setMentions([]);
		setQuery(null);
		setSuggestions([]);
		setSearchError(null);
		if (inputRef.current) inputRef.current.style.height = "auto";
	};

	const showListbox = query !== null && query.length >= 2;
	const activeSuggestion = suggestions[activeIndex];
	const suggestionStatus = !showListbox
		? ""
		: loading
			? "Searching for member suggestions."
			: searchError
				? `Member search failed: ${searchError}`
				: suggestions.length === 0
					? "No members found."
					: `${suggestions.length} member suggestion${suggestions.length === 1 ? "" : "s"} available. ${activeSuggestion?.name ?? ""} selected. Use the arrow keys to navigate and Enter or Tab to choose.`;
	return (
		<div className="relative">
			<p
				id={suggestionStatusId}
				className="sr-only"
				role="status"
				aria-live="polite"
			>
				{suggestionStatus}
			</p>
			{showListbox ? (
				<div className="beacon-fade-up absolute bottom-full left-0 z-30 mb-2 w-full min-w-0 overflow-hidden rounded-xl border border-border/70 bg-popover shadow-xl sm:w-80">
					<div className="border-b border-border/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						Reference a person
					</div>
					{loading ? (
						<div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
							<Spinner className="size-4" /> Searching…
						</div>
					) : null}
					{searchError ? (
						<p className="p-3 text-sm text-destructive" role="alert">
							{searchError}
						</p>
					) : null}
					{!loading && !searchError ? (
						<div
							id={listboxId}
							role="listbox"
							aria-label="Member suggestions"
							className="max-h-64 overflow-auto py-1"
						>
							{suggestions.length ? (
								suggestions.map((person, index) => (
									<div key={person.user_id}>
										<button
											type="button"
											tabIndex={-1}
											id={`${listboxId}-${person.user_id}`}
											role="option"
											aria-selected={index === activeIndex}
											onMouseEnter={() => setActiveIndex(index)}
											onMouseDown={(event) => event.preventDefault()}
											onClick={() => pick(person)}
											className={cn(
												"flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
												index === activeIndex
													? "bg-accent"
													: "hover:bg-accent/60",
											)}
										>
											<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
												{initialsOf(person.name)}
											</span>
											<span className="truncate">{person.name}</span>
										</button>
									</div>
								))
							) : (
								<div className="px-3 py-2 text-sm text-muted-foreground">
									No members found.
								</div>
							)}
						</div>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-1.5 rounded-[26px] border border-border/70 bg-card px-2.5 py-2 shadow-sm transition-all focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
				{mentions.length ? (
					<div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
						{mentions.map((mention) => (
							<span
								key={mention.user_id}
								className="inline-flex items-center gap-1 rounded-md bg-brand/10 py-0.5 pl-1.5 pr-1 text-sm font-medium text-brand"
							>
								@{mention.label}
								<button
									type="button"
									aria-label={`Remove ${mention.label}`}
									onClick={() => {
										setValue((current) =>
											current
												.replace(`@${mention.label}`, "")
												.replace(/\s{2,}/g, " "),
										);
										setMentions((current) =>
											current.filter(
												(item) => item.user_id !== mention.user_id,
											),
										);
									}}
									className="rounded p-0.5 hover:bg-brand/20"
								>
									<X className="size-3" />
								</button>
							</span>
						))}
					</div>
				) : null}
				<div className="flex items-end gap-1">
					<Textarea
						ref={inputRef}
						value={value}
						onChange={(event) => {
							setValue(event.target.value);
							updateTrigger(
								event.target.value,
								event.target.selectionStart ?? event.target.value.length,
							);
							event.target.style.height = "auto";
							event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
						}}
						onKeyDown={(event) => {
							if (showListbox && suggestions.length) {
								if (event.key === "ArrowDown" || event.key === "ArrowUp") {
									event.preventDefault();
									setActiveIndex((current) =>
										event.key === "ArrowDown"
											? (current + 1) % suggestions.length
											: (current - 1 + suggestions.length) % suggestions.length,
									);
									return;
								}
								if (
									(event.key === "Enter" || event.key === "Tab") &&
									activeSuggestion
								) {
									event.preventDefault();
									pick(activeSuggestion);
									return;
								}
							}
							if (event.key === "Escape") {
								setQuery(null);
								return;
							}
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								submit();
							}
						}}
						rows={1}
						placeholder="Ask Beacon anything"
						className="min-h-11 resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] shadow-none focus-visible:ring-0 sm:min-h-9"
						disabled={disabled}
						aria-autocomplete="list"
						aria-controls={
							showListbox && !loading && !searchError ? listboxId : undefined
						}
						aria-activedescendant={
							showListbox && !loading && !searchError && activeSuggestion
								? `${listboxId}-${activeSuggestion.user_id}`
								: undefined
						}
						aria-describedby={suggestionStatusId}
						aria-label="Ask Beacon"
					/>
					<Button
						type="button"
						size="icon"
						onClick={submit}
						disabled={disabled || !value.trim()}
						aria-label="Send message"
						className="size-11 shrink-0 rounded-full bg-brand text-brand-foreground hover:bg-[#523573] sm:size-9"
					>
						{disabled ? (
							<Spinner className="size-4" />
						) : (
							<ArrowUp className="size-5" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
