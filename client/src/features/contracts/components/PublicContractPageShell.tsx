import type { ReactNode } from "react";

export function PublicContractPageShell({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}): JSX.Element {
	return (
		<main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
			<div className="mx-auto w-full max-w-4xl">
				<header className="mb-6">
					<p className="text-sm font-semibold tracking-wide text-brand">
						TUM.ai
					</p>
					<h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
						{title}
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
				</header>
				{children}
			</div>
		</main>
	);
}
