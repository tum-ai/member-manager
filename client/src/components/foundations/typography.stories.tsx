import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
	title: "Foundations/Typography",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const SCALE = [
	{ label: "Display", className: "font-semibold text-4xl tracking-tight" },
	{ label: "Heading 1", className: "font-semibold text-3xl tracking-tight" },
	{ label: "Heading 2", className: "font-semibold text-2xl tracking-tight" },
	{ label: "Heading 3", className: "font-semibold text-xl" },
	{ label: "Large", className: "font-medium text-lg" },
	{ label: "Body", className: "text-base" },
	{ label: "Small", className: "text-sm" },
	{ label: "Muted", className: "text-muted-foreground text-sm" },
	{ label: "Caption", className: "text-muted-foreground text-xs" },
];

export const TypeScale: Story = {
	render: () => (
		<div className="space-y-6 bg-background p-8 text-foreground">
			<div className="space-y-1">
				<h2 className="font-semibold text-xl tracking-tight">Typography</h2>
				<p className="text-muted-foreground text-sm">
					Manrope across the scale.
				</p>
			</div>
			<div className="space-y-4">
				{SCALE.map((row) => (
					<div
						key={row.label}
						className="flex flex-col gap-1 border-b pb-4 last:border-0"
					>
						<span className="text-muted-foreground text-xs uppercase tracking-wide">
							{row.label}
						</span>
						<span className={row.className}>
							The quick brown fox jumps over the lazy dog
						</span>
					</div>
				))}
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs uppercase tracking-wide">
						Mono
					</span>
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
						const member = await getMember(id)
					</code>
				</div>
			</div>
		</div>
	),
};
