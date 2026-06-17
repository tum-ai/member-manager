import type { LucideIcon } from "lucide-react";

interface SectionHeadingProps {
	icon: LucideIcon;
	title: string;
	description?: string;
}

export function SectionHeading({
	icon: Icon,
	title,
	description,
}: SectionHeadingProps): JSX.Element {
	return (
		<div className="mb-6">
			<div className="flex items-center gap-2.5">
				<Icon className="size-5 text-brand" />
				<h2 className="text-base font-semibold">{title}</h2>
			</div>
			{description && (
				<p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
			)}
		</div>
	);
}
