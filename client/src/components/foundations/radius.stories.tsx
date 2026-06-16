import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
	title: "Foundations/Radius",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const RADII = [
	{ name: "sm", className: "rounded-sm" },
	{ name: "md", className: "rounded-md" },
	{ name: "lg (base)", className: "rounded-lg" },
	{ name: "xl", className: "rounded-xl" },
	{ name: "full", className: "rounded-full" },
];

export const Radius: Story = {
	render: () => (
		<div className="space-y-6 bg-background p-8 text-foreground">
			<div className="space-y-1">
				<h2 className="font-semibold text-xl tracking-tight">Radius</h2>
				<p className="text-muted-foreground text-sm">
					Scale derived from <code className="text-xs">--radius</code>{" "}
					(0.625rem).
				</p>
			</div>
			<div className="flex flex-wrap gap-6">
				{RADII.map((r) => (
					<div key={r.name} className="flex flex-col items-center gap-2">
						<div
							className={`size-24 border-2 border-brand bg-accent ${r.className}`}
						/>
						<span className="text-muted-foreground text-xs">{r.name}</span>
					</div>
				))}
			</div>
		</div>
	),
};
