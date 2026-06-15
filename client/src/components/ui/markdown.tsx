import type { CSSProperties } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/*
 * Minimal markdown renderer. Element styles are intentionally compact (headings
 * capped small) so user-authored `## headings` and `- bullets` read cleanly
 * inside cards instead of printing as raw text. For previews, pass `clampHeight`
 * to cap the rendered height with a soft fade — line-clamp can't clamp markdown's
 * block children reliably, so we mask by height instead.
 */
const markdownComponents: Components = {
	h1: ({ node: _node, ...props }) => (
		<h3 className="mt-3 mb-1.5 text-base font-semibold first:mt-0" {...props} />
	),
	h2: ({ node: _node, ...props }) => (
		<h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0" {...props} />
	),
	h3: ({ node: _node, ...props }) => (
		<h5 className="mt-2.5 mb-1 text-sm font-medium first:mt-0" {...props} />
	),
	h4: ({ node: _node, ...props }) => (
		<h6 className="mt-2.5 mb-1 text-sm font-medium first:mt-0" {...props} />
	),
	p: ({ node: _node, ...props }) => (
		<p className="mb-2 leading-relaxed last:mb-0" {...props} />
	),
	ul: ({ node: _node, ...props }) => (
		<ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0" {...props} />
	),
	ol: ({ node: _node, ...props }) => (
		<ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0" {...props} />
	),
	li: ({ node: _node, ...props }) => (
		<li className="leading-relaxed" {...props} />
	),
	strong: ({ node: _node, ...props }) => (
		<strong className="font-semibold" {...props} />
	),
	em: ({ node: _node, ...props }) => <em className="italic" {...props} />,
	a: ({ node: _node, ...props }) => (
		<a
			className="text-brand underline underline-offset-2"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		/>
	),
	code: ({ node: _node, ...props }) => (
		<code
			className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
			{...props}
		/>
	),
	hr: ({ node: _node, ...props }) => (
		<hr className="my-3 border-border" {...props} />
	),
	blockquote: ({ node: _node, ...props }) => (
		<blockquote
			className="border-l-2 border-border pl-3 text-muted-foreground italic"
			{...props}
		/>
	),
};

export interface MarkdownProps {
	children: string;
	className?: string;
	/** Cap rendered height (e.g. "7.5rem") with a soft bottom fade for previews. */
	clampHeight?: string;
}

export function Markdown({
	children,
	className,
	clampHeight,
}: MarkdownProps): React.ReactElement {
	const clampStyle: CSSProperties | undefined = clampHeight
		? {
				maxHeight: clampHeight,
				WebkitMaskImage:
					"linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)",
				maskImage:
					"linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)",
			}
		: undefined;

	return (
		<div
			className={cn("text-sm", clampHeight && "overflow-hidden", className)}
			style={clampStyle}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={markdownComponents}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}

export default Markdown;
