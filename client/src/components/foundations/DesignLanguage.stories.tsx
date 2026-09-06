import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarDays, Inbox, PanelLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { SectionCard } from "./SectionCard";

const meta = {
	title: "Foundations/Design Language",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen", a11y: { test: "error" } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const TYPE_SCALE = [
	{
		role: "Eyebrow",
		className: "font-medium text-brand text-xs uppercase tracking-wide",
	},
	{
		role: "Page title (h1)",
		className: "font-semibold text-3xl tracking-tight",
	},
	{ role: "Section title (h2)", className: "font-semibold text-lg" },
	{ role: "Subsection (h3)", className: "font-semibold text-sm" },
	{ role: "Body", className: "text-sm" },
	{ role: "Caption / muted", className: "text-muted-foreground text-xs" },
];

const ELEVATION = [
	{ name: "shadow-raised", note: "default surfaces (cards, tiles)" },
	{ name: "shadow-overlay", note: "elevated / floating surfaces" },
];

export const Overview: Story = {
	render: () => (
		<div className="space-y-12 bg-background p-4 text-foreground sm:p-8">
			<div className="space-y-1">
				<h2 className="font-semibold text-xl tracking-tight">
					Design language
				</h2>
				<p className="max-w-2xl text-muted-foreground text-sm">
					One vocabulary for every feature: a shared type scale, a soft
					elevation ramp, restrained brand-purple accents, and a small motion
					set. Toggle the Storybook theme to compare light and dark.
				</p>
			</div>

			<section className="space-y-4">
				<h3 className="font-semibold text-sm tracking-tight">Type scale</h3>
				<div className="space-y-4">
					{TYPE_SCALE.map((row) => (
						<div
							key={row.role}
							className="flex flex-col gap-1 border-b pb-4 last:border-0"
						>
							<span className="text-muted-foreground text-xs uppercase tracking-wide">
								{row.role}
							</span>
							<span className={row.className}>
								The quick brown fox jumps over the lazy dog
							</span>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-4">
				<h3 className="font-semibold text-sm tracking-tight">Elevation</h3>
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					{ELEVATION.map((e) => (
						<div
							key={e.name}
							className={`rounded-xl border bg-card p-6 ${e.name}`}
						>
							<div className="font-medium text-sm">{e.name}</div>
							<div className="text-muted-foreground text-xs">{e.note}</div>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-4">
				<h3 className="font-semibold text-sm tracking-tight">
					Motion (hover the card)
				</h3>
				<GlassCard variant="interactive" className="max-w-xs p-6">
					<div className="font-medium text-sm">hover-lift</div>
					<div className="text-muted-foreground text-xs">
						Lifts on hover; respects reduced-motion.
					</div>
				</GlassCard>
				<GlassCard className="flex max-w-xs items-center gap-3 p-6">
					<Skeleton className="size-10 shrink-0 rounded-full" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-3 w-2/3" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				</GlassCard>
			</section>

			<section className="space-y-4">
				<h3 className="font-semibold text-sm tracking-tight">Status tones</h3>
				<div className="flex flex-wrap gap-2">
					<Badge variant="success">Approved</Badge>
					<Badge variant="info">Submitted</Badge>
					<Badge variant="warning">Pending</Badge>
					<Badge variant="danger">Rejected</Badge>
					<Badge variant="neutral">Draft</Badge>
				</div>
			</section>

			<section className="space-y-4">
				<h3 className="font-semibold text-sm tracking-tight">App bar header</h3>
				<p className="max-w-2xl text-muted-foreground text-sm">
					The sticky top bar is the page header. Pages set it with{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">
						useSetPageHeader(title, description)
					</code>{" "}
					and render right-side controls with{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">
						PageHeaderActions
					</code>
					.
				</p>
				<div className="flex h-14 items-center gap-3 rounded-xl border bg-background/95 px-4">
					<PanelLeft className="size-5 text-muted-foreground" aria-hidden />
					<div className="flex min-w-0 flex-col justify-center">
						<span className="font-semibold text-base leading-tight">
							Reimbursements
						</span>
						<span className="text-muted-foreground text-xs leading-tight">
							Submit and track expense claims for your team.
						</span>
					</div>
					<div className="ml-auto">
						<Badge variant="accent">Actions slot</Badge>
					</div>
				</div>
			</section>

			<section className="space-y-4">
				<h3 className="font-semibold text-sm tracking-tight">Primitives</h3>
				<SectionCard
					icon={CalendarDays}
					title="Upcoming events"
					description="Everything on the calendar for the next month."
				>
					<p className="text-muted-foreground text-sm">Section content.</p>
				</SectionCard>
				<EmptyState
					icon={Inbox}
					title="No requests yet"
					description="When a member submits a request, it shows up here."
				/>
			</section>
		</div>
	),
};

export const DarkOverview: Story = {
	...Overview,
	globals: { theme: "dark" },
};
