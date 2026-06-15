import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
	title: "Foundations/Colors",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

type Swatch = {
	name: string;
	className: string;
	note?: string;
};

function SwatchGrid({
	title,
	swatches,
}: {
	title: string;
	swatches: Swatch[];
}) {
	return (
		<section className="space-y-3">
			<h3 className="font-semibold text-sm tracking-tight">{title}</h3>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{swatches.map((s) => (
					<div
						key={s.name}
						className="overflow-hidden rounded-lg border bg-card text-card-foreground"
					>
						<div className={`h-16 w-full ${s.className}`} />
						<div className="space-y-0.5 p-3">
							<div className="font-medium text-sm">{s.name}</div>
							{s.note ? (
								<div className="text-muted-foreground text-xs">{s.note}</div>
							) : null}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

const SEMANTIC: Swatch[] = [
	{ name: "background", className: "bg-background border" },
	{ name: "foreground", className: "bg-foreground" },
	{ name: "card", className: "bg-card border" },
	{ name: "muted", className: "bg-muted" },
	{ name: "muted-foreground", className: "bg-muted-foreground" },
	{ name: "border", className: "bg-border" },
	{ name: "primary", className: "bg-primary", note: "neutral — main actions" },
	{ name: "secondary", className: "bg-secondary" },
];

const ACCENT: Swatch[] = [
	{ name: "brand", className: "bg-brand", note: "TUM.ai purple accent" },
	{
		name: "accent",
		className: "bg-accent",
		note: "soft lavender hover/selected",
	},
	{ name: "accent-foreground", className: "bg-accent-foreground" },
	{ name: "ring", className: "bg-ring", note: "focus ring" },
	{ name: "destructive", className: "bg-destructive" },
];

const SIDEBAR: Swatch[] = [
	{ name: "sidebar", className: "bg-sidebar border" },
	{
		name: "sidebar-primary",
		className: "bg-sidebar-primary",
		note: "active item",
	},
	{ name: "sidebar-accent", className: "bg-sidebar-accent", note: "hover" },
	{ name: "sidebar-border", className: "bg-sidebar-border" },
];

const CHART: Swatch[] = [
	{ name: "chart-1", className: "bg-chart-1" },
	{ name: "chart-2", className: "bg-chart-2" },
	{ name: "chart-3", className: "bg-chart-3" },
	{ name: "chart-4", className: "bg-chart-4" },
	{ name: "chart-5", className: "bg-chart-5" },
];

export const Palette: Story = {
	render: () => (
		<div className="space-y-8 bg-background p-8 text-foreground">
			<div className="space-y-1">
				<h2 className="font-semibold text-xl tracking-tight">Color tokens</h2>
				<p className="text-muted-foreground text-sm">
					Neutral base with the TUM.ai purple as an accent. Toggle the Storybook
					theme to compare light and dark.
				</p>
			</div>
			<SwatchGrid title="Semantic / neutral" swatches={SEMANTIC} />
			<SwatchGrid title="Accent (purple)" swatches={ACCENT} />
			<SwatchGrid title="Sidebar" swatches={SIDEBAR} />
			<SwatchGrid title="Charts" swatches={CHART} />
		</div>
	),
};
