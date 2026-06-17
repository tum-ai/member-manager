import {
	FileSignature,
	Moon,
	Network,
	Receipt,
	ShieldCheck,
	Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { SlackIcon } from "@/components/icons/SlackIcon";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSlackRedirectUrl } from "../../lib/authRedirect";
import { supabase } from "../../lib/supabaseClient";

const FEATURES = [
	{
		icon: FileSignature,
		title: "Contracts & signatures",
		desc: "Draft, sign, and track membership contracts in one place.",
	},
	{
		icon: Receipt,
		title: "Reimbursements",
		desc: "Submit expenses and follow their approval status.",
	},
	{
		icon: Network,
		title: "Org charts & profiles",
		desc: "Find members, teams, and project structures.",
	},
	{
		icon: ShieldCheck,
		title: "Certificates & admin",
		desc: "Engagement certificates and admin tooling.",
	},
] as const;

function isLocalSupabaseHostname(hostname: string): boolean {
	return (
		hostname === "127.0.0.1" ||
		hostname === "localhost" ||
		// Private LAN ranges, so a local Supabase reached via the machine's
		// network IP (e.g. when testing on a phone) still counts as local.
		/^10\./.test(hostname) ||
		/^192\.168\./.test(hostname) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
	);
}

function isLocalSupabaseProject(): boolean {
	try {
		const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
		return import.meta.env.DEV && isLocalSupabaseHostname(supabaseUrl.hostname);
	} catch {
		return false;
	}
}

export function Auth() {
	const [message, setMessage] = useState("");
	const [localLoginInProgress, setLocalLoginInProgress] = useState<
		"admin" | "regular" | null
	>(null);

	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const showLocalAdminLogin = isLocalSupabaseProject();

	const signInWithSlack = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "slack_oidc",
			options: {
				redirectTo: getSlackRedirectUrl({
					currentOrigin:
						typeof window === "undefined" ? undefined : window.location.origin,
					configuredRedirectUrl: import.meta.env.VITE_SLACK_CALLBACK_URL,
				}),
			},
		});

		if (error) {
			console.error("Slack error:", error.message);
			setMessage(`Slack error: ${error.message}`);
			return;
		}
	};

	const signInWithLocalUser = async (
		kind: "admin" | "regular",
		email: string,
	) => {
		setMessage("");
		setLocalLoginInProgress(kind);

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password: "password123",
		});

		setLocalLoginInProgress(null);

		if (error) {
			console.error(`Local ${kind} login error:`, error.message);
			setMessage(`Local ${kind} login error: ${error.message}`);
		}
	};

	return (
		<div className="relative min-h-screen bg-background">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setTheme(isDark ? "light" : "dark")}
							className="absolute top-5 right-5 z-20 md:top-7 md:right-7"
							aria-label={
								isDark ? "Switch to light mode" : "Switch to night mode"
							}
						>
							{isDark ? <Sun /> : <Moon />}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						{isDark ? "Switch to light mode" : "Switch to night mode"}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div className="grid min-h-screen lg:grid-cols-2">
				<section
					data-testid="auth-logo-surface"
					className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
					style={{
						background:
							"linear-gradient(135deg, rgba(27, 0, 73, 0.98) 0%, rgba(82, 53, 115, 0.98) 100%)",
					}}
				>
					<div
						aria-hidden
						className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
					/>

					<img
						src="/img/tum_ai_logo_new.svg"
						alt="TUM.ai Logo"
						className="relative h-9 w-auto"
					/>

					<div className="relative max-w-md">
						<h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
							The internal platform for TUM.ai members.
						</h2>
						<p className="mt-4 text-base text-white/70">
							One place for your profile, contracts, reimbursements,
							certificates, and the people you work with.
						</p>

						<ul className="mt-10 space-y-5">
							{FEATURES.map(({ icon: Icon, title, desc }) => (
								<li key={title} className="flex items-start gap-4">
									<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
										<Icon className="size-5 text-white" />
									</span>
									<div>
										<p className="font-semibold">{title}</p>
										<p className="text-sm text-white/65">{desc}</p>
									</div>
								</li>
							))}
						</ul>
					</div>

					<p className="relative text-sm text-white/50">
						TUM.ai Member Manager
					</p>
				</section>

				<section className="flex items-center justify-center px-4 py-12 md:px-8">
					<div className="w-full max-w-sm">
						<div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
							<img
								src="/img/tum_ai_logo_mark_light.svg"
								alt="TUM.ai"
								className="h-12 w-auto dark:hidden"
							/>
							<img
								src="/img/tum_ai_logo_mark_dark.svg"
								alt="TUM.ai"
								className="hidden h-12 w-auto dark:block"
							/>
						</div>

						<div className="space-y-2 text-center lg:text-left">
							<h1 className="text-2xl font-bold tracking-tight">
								Sign in to Member Manager
							</h1>
							<p className="text-sm text-muted-foreground">
								Use your TUM.ai Slack account to continue.
							</p>
						</div>

						<div className="mt-8 space-y-4">
							<Button
								size="lg"
								className="h-12 w-full text-base"
								onClick={signInWithSlack}
							>
								<SlackIcon className="size-5" />
								Continue with Slack
							</Button>

							{showLocalAdminLogin && (
								<>
									<div className="flex items-center gap-3">
										<Separator className="flex-1" />
										<span className="text-xs uppercase tracking-wider text-muted-foreground">
											Local dev
										</span>
										<Separator className="flex-1" />
									</div>

									<div className="grid gap-3">
										<Button
											variant="outline"
											className="h-11"
											onClick={() =>
												signInWithLocalUser("admin", "admin@example.com")
											}
											disabled={localLoginInProgress !== null}
										>
											{localLoginInProgress === "admin"
												? "Signing in..."
												: "Continue as local admin"}
										</Button>
										<Button
											variant="outline"
											className="h-11"
											onClick={() =>
												signInWithLocalUser(
													"regular",
													"regular-member@example.com",
												)
											}
											disabled={localLoginInProgress !== null}
										>
											{localLoginInProgress === "regular"
												? "Signing in..."
												: "Continue as regular user"}
										</Button>
									</div>
								</>
							)}

							{message && (
								<InfoBox
									role="alert"
									variant="destructive"
									className="px-4 py-3 text-center text-sm text-destructive"
								>
									{message}
								</InfoBox>
							)}
						</div>

						<p className="mt-8 text-center text-xs text-muted-foreground lg:text-left">
							By continuing you agree to TUM.ai's internal usage guidelines.
						</p>
					</div>
				</section>
			</div>
		</div>
	);
}
