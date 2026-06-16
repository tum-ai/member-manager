import { ArrowUp, AudioLines, ChevronDown, Mic, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { searchPeople } from "../../hooks/useExpertiseSearch";
import type { ComposerMention, PersonSuggestion } from "./types";

interface ComposerProps {
	onSubmit: (text: string, mentions: ComposerMention[]) => void;
	disabled?: boolean;
	autoFocus?: boolean;
}

const MENTION_TRIGGER = /@([\p{L}\p{N}_]*)$/u;
const EFFORTS = ["High", "Balanced", "Fast"] as const;

function initialsOf(name: string): string {
	return (
		name
			.split(/\s+/)
			.map((s) => s.charAt(0))
			.join("")
			.slice(0, 2)
			.toUpperCase() || "?"
	);
}

export function Composer({
	onSubmit,
	disabled,
	autoFocus,
}: ComposerProps): JSX.Element {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [value, setValue] = useState("");
	const [mentions, setMentions] = useState<ComposerMention[]>([]);
	const [query, setQuery] = useState<string | null>(null);
	const [suggestions, setSuggestions] = useState<PersonSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [active, setActive] = useState(0);
	// Reserved for the future routing/effort selector; not sent to the (fixed)
	// pipeline yet.
	const [effort, setEffort] = useState<(typeof EFFORTS)[number]>("High");

	// biome-ignore lint/correctness/useExhaustiveDependencies: focus once on mount
	useEffect(() => {
		if (autoFocus) ref.current?.focus();
	}, []);

	useEffect(() => {
		if (query === null || query.length < 2) {
			setSuggestions([]);
			return;
		}
		let cancelled = false;
		setLoading(true);
		const t = setTimeout(async () => {
			try {
				const people = await searchPeople(query);
				if (!cancelled) {
					setSuggestions(people);
					setActive(0);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}, 160);
		return () => {
			cancelled = true;
			clearTimeout(t);
		};
	}, [query]);

	const updateTrigger = (text: string, caret: number) => {
		const m = MENTION_TRIGGER.exec(text.slice(0, caret));
		setQuery(m ? m[1] : null);
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		updateTrigger(
			e.target.value,
			e.target.selectionStart ?? e.target.value.length,
		);
		const el = e.target;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	};

	const pick = (p: PersonSuggestion) => {
		const caret = ref.current?.selectionStart ?? value.length;
		const before = value
			.slice(0, caret)
			.replace(MENTION_TRIGGER, `@${p.name} `);
		setValue(before + value.slice(caret));
		setMentions((prev) =>
			prev.some((m) => m.user_id === p.user_id)
				? prev
				: [...prev, { user_id: p.user_id, label: p.name }],
		);
		setQuery(null);
		setSuggestions([]);
		ref.current?.focus();
	};

	const removeMention = (userId: string) => {
		const m = mentions.find((x) => x.user_id === userId);
		if (m)
			setValue((v) => v.replace(`@${m.label}`, "").replace(/\s{2,}/g, " "));
		setMentions((prev) => prev.filter((x) => x.user_id !== userId));
	};

	const submit = () => {
		const text = value.trim();
		if (!text || disabled) return;
		const activeMentions = mentions.filter((m) => text.includes(`@${m.label}`));
		onSubmit(text, activeMentions);
		setValue("");
		setMentions([]);
		setQuery(null);
		setSuggestions([]);
		if (ref.current) ref.current.style.height = "auto";
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (query !== null && suggestions.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActive((a) => (a + 1) % suggestions.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				pick(suggestions[active]);
				return;
			}
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
		if (e.key === "Escape") setQuery(null);
	};

	const showPopover = query !== null && (loading || suggestions.length > 0);
	const hasText = value.trim().length > 0;

	return (
		<div className="relative">
			{showPopover && (
				<div className="beacon-fade-up absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-xl">
					<div className="border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						Reference a person
					</div>
					{loading && suggestions.length === 0 ? (
						<div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
							<Spinner className="size-4" /> Searching…
						</div>
					) : (
						<ul className="max-h-64 overflow-auto py-1">
							{suggestions.map((p, i) => (
								<li key={p.user_id}>
									<button
										type="button"
										onMouseEnter={() => setActive(i)}
										onClick={() => pick(p)}
										className={cn(
											"flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
											i === active ? "bg-accent" : "hover:bg-accent/60",
										)}
									>
										<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
											{initialsOf(p.name)}
										</span>
										<span className="truncate">{p.name}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			<div className="flex flex-col gap-1.5 rounded-[26px] border bg-card px-2.5 py-2 shadow-sm transition-all focus-within:border-brand/40 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_12%,transparent)]">
				{mentions.length > 0 && (
					<div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
						{mentions.map((m) => (
							<span
								key={m.user_id}
								className="inline-flex items-center gap-1 rounded-md bg-brand/10 py-0.5 pl-1.5 pr-1 text-sm font-medium text-brand"
							>
								@{m.label}
								<button
									type="button"
									aria-label={`Remove ${m.label}`}
									onClick={() => removeMention(m.user_id)}
									className="rounded p-0.5 hover:bg-brand/20"
								>
									<X className="size-3" />
								</button>
							</span>
						))}
					</div>
				)}

				<div className="flex items-end gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="shrink-0 rounded-full text-muted-foreground"
						aria-label="Add context"
					>
						<Plus className="size-5" />
					</Button>

					<Textarea
						ref={ref}
						value={value}
						onChange={handleChange}
						onKeyDown={onKeyDown}
						rows={1}
						placeholder="Ask anything"
						className="min-h-[2.25rem] resize-none border-0 bg-transparent px-1 py-1.5 text-[15px] shadow-none focus-visible:ring-0"
						disabled={disabled}
					/>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent"
							>
								{effort}
								<ChevronDown className="size-3.5" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{EFFORTS.map((e) => (
								<DropdownMenuItem key={e} onClick={() => setEffort(e)}>
									{e}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="shrink-0 rounded-full text-muted-foreground"
						aria-label="Voice input"
					>
						<Mic className="size-5" />
					</Button>

					<Button
						type="button"
						size="icon"
						onClick={submit}
						disabled={disabled}
						aria-label={hasText ? "Send" : "Voice mode"}
						className="size-9 shrink-0 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
					>
						{disabled ? (
							<Spinner className="size-4" />
						) : hasText ? (
							<ArrowUp className="size-5" />
						) : (
							<AudioLines className="size-5" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
