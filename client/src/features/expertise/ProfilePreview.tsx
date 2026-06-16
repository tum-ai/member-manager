import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiClient } from "../../lib/apiClient";
import type { EmploymentClaim, ExpertiseProfile, SkillClaim } from "./types";

const CARD_WIDTH = 300;

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

// Shares the ["expertise", userId] cache with the profile drawer, so hovering a
// name pre-warms the click.
function useProfilePreview(userId: string, enabled: boolean) {
	return useQuery({
		queryKey: ["expertise", userId],
		queryFn: async () =>
			(await apiClient(`/api/expertise/${userId}`, {
				method: "GET",
			})) as ExpertiseProfile,
		enabled,
		staleTime: 60_000,
	});
}

interface HoverPreviewProps {
	userId: string;
	name: string;
	children: ReactNode;
	onOpen: () => void;
	className?: string;
}

// Wraps an inline trigger (a colored @mention). On hover it floats a
// non-interactive profile preview above the name (portaled so it never clips).
export function HoverPreview({
	userId,
	name,
	children,
	onOpen,
	className,
}: HoverPreviewProps): JSX.Element {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const timer = useRef<number | null>(null);
	const [coords, setCoords] = useState<{
		left: number;
		top: number;
		below: boolean;
	} | null>(null);
	const labelId = useId();

	const open = () => {
		const el = triggerRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const below = r.top < 260;
		const left = Math.min(
			Math.max(r.left, 8),
			window.innerWidth - CARD_WIDTH - 8,
		);
		setCoords({ left, top: below ? r.bottom + 8 : r.top - 8, below });
	};

	const scheduleOpen = () => {
		if (timer.current) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(open, 200);
	};
	const scheduleClose = () => {
		if (timer.current) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCoords(null), 120);
	};

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={onOpen}
				onMouseEnter={scheduleOpen}
				onMouseLeave={scheduleClose}
				onFocus={open}
				onBlur={() => setCoords(null)}
				aria-describedby={coords ? labelId : undefined}
				className={cn(
					"rounded-md bg-brand/10 px-1 py-0.5 font-medium text-brand transition-colors hover:bg-brand/20",
					className,
				)}
			>
				{children}
			</button>
			{coords &&
				createPortal(
					<div
						id={labelId}
						role="tooltip"
						className="beacon-fade-up pointer-events-none fixed z-50"
						style={{
							left: coords.left,
							top: coords.top,
							width: CARD_WIDTH,
							transform: coords.below ? undefined : "translateY(-100%)",
						}}
					>
						<PreviewCard userId={userId} name={name} />
					</div>,
					document.body,
				)}
		</>
	);
}

function PreviewCard({
	userId,
	name,
}: {
	userId: string;
	name: string;
}): JSX.Element {
	const { data, isLoading } = useProfilePreview(userId, true);
	const member = data?.member;
	const meta = [member?.department, member?.member_role]
		.filter(Boolean)
		.join(" · ");
	const employment = (data?.employment as EmploymentClaim[] | undefined)?.[0];
	const role = employment
		? [employment.title, employment.organization?.name]
				.filter(Boolean)
				.join(" · ")
		: null;
	const skills = (data?.skills as SkillClaim[] | undefined)
		?.slice(0, 4)
		.map((s) => s.skill?.name ?? s.raw_value)
		.filter(Boolean) as string[] | undefined;

	return (
		<div className="overflow-hidden rounded-xl border bg-popover p-3 shadow-xl">
			<div className="flex items-center gap-2.5">
				<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
					{initialsOf(name)}
				</span>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">{name}</p>
					{meta && (
						<p className="truncate text-xs text-muted-foreground">{meta}</p>
					)}
				</div>
			</div>

			{isLoading ? (
				<div className="mt-3 space-y-2">
					<Skeleton className="h-3 w-4/5" />
					<Skeleton className="h-3 w-3/5" />
				</div>
			) : (
				<div className="mt-2.5 space-y-2">
					{data?.person?.headline && (
						<p className="line-clamp-2 text-xs font-medium text-brand">
							{data.person.headline}
						</p>
					)}
					{role && (
						<p className="line-clamp-1 text-xs text-muted-foreground">{role}</p>
					)}
					{skills && skills.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{skills.map((s) => (
								<span
									key={s}
									className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
								>
									{s}
								</span>
							))}
						</div>
					)}
					{!data?.person?.headline && !role && !skills?.length && (
						<p className="text-xs text-muted-foreground">
							No public details yet.
						</p>
					)}
				</div>
			)}
			<p className="mt-2.5 border-t pt-2 text-[11px] text-muted-foreground">
				Click to open full profile
			</p>
		</div>
	);
}
