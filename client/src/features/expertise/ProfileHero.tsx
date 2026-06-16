import { CircleCheck, Clock, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

interface ProfileHeroProps {
	name: string;
	initials: string;
	role?: string | null;
	dept?: string | null;
	headline?: string | null;
	confirmed: number;
	pending: number;
	editable: boolean;
	optedOut: boolean;
	onToggleOptOut?: (v: boolean) => void;
	busyOptOut?: boolean;
}

export function ProfileHero({
	name,
	initials,
	role,
	dept,
	headline,
	confirmed,
	pending,
	editable,
	optedOut,
	onToggleOptOut,
	busyOptOut,
}: ProfileHeroProps): JSX.Element {
	const meta = [dept, role].filter(Boolean).join(" · ");
	return (
		<div className="beacon-hero-gradient relative overflow-hidden rounded-2xl border p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 items-center gap-4">
					<Avatar className="size-20 shrink-0 ring-4 ring-background">
						<AvatarFallback className="bg-brand/15 text-2xl font-semibold text-brand">
							{initials}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<h1 className="truncate text-2xl font-bold leading-tight">
							{name}
						</h1>
						{meta && (
							<p className="mt-0.5 truncate text-sm text-muted-foreground">
								{meta}
							</p>
						)}
						{headline && (
							<p className="mt-1.5 line-clamp-2 text-sm font-medium text-brand">
								{headline}
							</p>
						)}
						<div className="mt-3 flex flex-wrap items-center gap-2">
							<Stat
								icon={<CircleCheck className="size-3.5" />}
								label={`${confirmed} confirmed`}
								tone="confirmed"
							/>
							{pending > 0 && (
								<Stat
									icon={<Clock className="size-3.5" />}
									label={`${pending} to review`}
									tone="pending"
								/>
							)}
						</div>
					</div>
				</div>

				{editable && (
					<div className="flex items-center gap-2.5 rounded-xl border bg-background/60 px-3 py-2 backdrop-blur-sm">
						<EyeOff className="size-4 text-muted-foreground" />
						<div className="text-xs">
							<p className="font-medium leading-tight">Hide from directory</p>
							<p className="text-muted-foreground">Opt out of search</p>
						</div>
						<Switch
							checked={optedOut}
							onCheckedChange={onToggleOptOut}
							disabled={busyOptOut}
							aria-label="Opt out of expertise directory"
						/>
					</div>
				)}
			</div>
		</div>
	);
}

function Stat({
	icon,
	label,
	tone,
}: {
	icon: JSX.Element;
	label: string;
	tone: "confirmed" | "pending";
}): JSX.Element {
	const cls =
		tone === "confirmed"
			? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
			: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
		>
			{icon}
			{label}
		</span>
	);
}
