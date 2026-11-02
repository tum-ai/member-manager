import type { ReactNode } from "react";
import { TUM_AI_LOGO_MARK_DARK, TUM_AI_LOGO_MARK_LIGHT } from "@/lib/branding";

/**
 * Full-screen frame for the consent page. It renders outside the app shell
 * (no sidebar, no /welcome redirect), like the public signing pages.
 */
export function OAuthPageShell({
	children,
}: {
	children: ReactNode;
}): JSX.Element {
	return (
		<main className="min-h-screen bg-background px-4 py-10 text-foreground sm:py-16">
			<div className="mx-auto w-full max-w-lg">
				<header className="mb-6 flex items-center gap-3">
					<img
						src={TUM_AI_LOGO_MARK_LIGHT}
						alt=""
						className="h-9 w-auto dark:hidden"
					/>
					<img
						src={TUM_AI_LOGO_MARK_DARK}
						alt=""
						className="hidden h-9 w-auto dark:block"
					/>
					<div>
						<p className="text-sm font-semibold tracking-wide text-brand">
							TUM.ai Member Manager
						</p>
						<h1 className="text-2xl font-bold tracking-tight">
							Connect an app
						</h1>
					</div>
				</header>
				{children}
			</div>
		</main>
	);
}
