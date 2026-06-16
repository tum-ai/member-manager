import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { HoverPreview } from "./ProfilePreview";

// The server cites people with the token @[Display Name](beacon:UUID) — which is
// just a Markdown link with a `beacon:` scheme, so Markdown renders the name as
// a link and we swap `beacon:` links for clickable mention chips below.
const MENTION_RE = /@\[([^\]]+)\]\(beacon:([0-9a-f-]{36})\)/g;
const BEACON_HREF = /^beacon:([0-9a-f-]{36})$/;

// Strip mention syntax to plain "@Name" (for copy-to-clipboard).
export function toPlainText(text: string): string {
	return text.replace(MENTION_RE, "@$1");
}

type OpenProfile = (userId: string, name: string) => void;

function childText(children: ReactNode): string {
	if (typeof children === "string") return children;
	if (Array.isArray(children)) return children.map(childText).join("");
	return "";
}

// Preserve our custom `beacon:` scheme (react-markdown strips unknown schemes by
// default); everything else goes through the default sanitizer.
function urlTransform(url: string): string {
	return url.startsWith("beacon:") ? url : defaultUrlTransform(url);
}

// Render an assistant message as Markdown, with `beacon:` links shown as
// clickable @mention chips (hover preview + opens the profile drawer).
export function MarkdownMessage({
	text,
	onOpenProfile,
}: {
	text: string;
	onOpenProfile: OpenProfile;
}): JSX.Element {
	// Drop the leading "@" from the token so the chip itself owns the "@" (and its
	// background) rather than leaving a stray plain "@" in front of it.
	const cleaned = text.replace(/@(\[[^\]]+\]\(beacon:[0-9a-f-]{36}\))/g, "$1");
	return (
		<div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				urlTransform={urlTransform}
				components={{
					p: ({ children }) => <p className="leading-relaxed">{children}</p>,
					ul: ({ children }) => (
						<ul className="list-disc space-y-1 pl-5">{children}</ul>
					),
					ol: ({ children }) => (
						<ol className="list-decimal space-y-1 pl-5">{children}</ol>
					),
					li: ({ children }) => <li className="leading-relaxed">{children}</li>,
					strong: ({ children }) => (
						<strong className="font-semibold">{children}</strong>
					),
					em: ({ children }) => <em className="italic">{children}</em>,
					h1: ({ children }) => (
						<h1 className="mt-2 text-base font-semibold">{children}</h1>
					),
					h2: ({ children }) => (
						<h2 className="mt-2 text-base font-semibold">{children}</h2>
					),
					h3: ({ children }) => (
						<h3 className="mt-2 text-sm font-semibold">{children}</h3>
					),
					code: ({ children }) => (
						<code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
							{children}
						</code>
					),
					a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => {
						const m = href ? BEACON_HREF.exec(href) : null;
						if (m) {
							const userId = m[1];
							const name = childText(children) || "member";
							return (
								<HoverPreview
									userId={userId}
									name={name}
									onOpen={() => onOpenProfile(userId, name)}
									className="whitespace-nowrap"
								>
									@{children}
								</HoverPreview>
							);
						}
						return (
							<a
								href={href}
								target="_blank"
								rel="noreferrer"
								className="text-brand underline"
								{...props}
							>
								{children}
							</a>
						);
					},
				}}
			>
				{cleaned}
			</ReactMarkdown>
		</div>
	);
}
