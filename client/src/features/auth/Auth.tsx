import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSlackRedirectUrl } from "../../lib/authRedirect";
import { supabase } from "../../lib/supabaseClient";

function isLocalSupabaseProject(): boolean {
	try {
		const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
		return (
			import.meta.env.DEV &&
			(supabaseUrl.hostname === "127.0.0.1" ||
				supabaseUrl.hostname === "localhost")
		);
	} catch {
		return false;
	}
}

export default function Auth() {
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
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 md:px-6 md:py-12">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setTheme(isDark ? "light" : "dark")}
							className="absolute top-5 right-5 z-10 md:top-7 md:right-7"
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

			<Card className="z-1 flex w-full max-w-md flex-col items-center gap-6 p-8 md:p-10">
				<div
					data-testid="auth-logo-surface"
					className="flex w-full max-w-60 items-center justify-center rounded-xl px-6 py-5"
					style={{
						background:
							"linear-gradient(135deg, rgba(27, 0, 73, 0.98) 0%, rgba(82, 53, 115, 0.98) 100%)",
					}}
				>
					<img
						src="/img/tum_ai_logo_new.svg"
						alt="TUM.ai Logo"
						className="block w-42"
						style={{ width: 168 }}
					/>
				</div>

				<h1 className="text-center text-2xl font-bold tracking-tight">
					Member Manager
				</h1>

				<Button className="h-13 w-full" onClick={signInWithSlack}>
					Continue with Slack
				</Button>

				{showLocalAdminLogin && (
					<div className="grid w-full gap-3">
						<Button
							variant="outline"
							className="h-12"
							onClick={() => signInWithLocalUser("admin", "admin@example.com")}
							disabled={localLoginInProgress !== null}
						>
							{localLoginInProgress === "admin"
								? "Signing in..."
								: "Continue as local admin"}
						</Button>
						<Button
							variant="outline"
							className="h-12"
							onClick={() =>
								signInWithLocalUser("regular", "regular-member@example.com")
							}
							disabled={localLoginInProgress !== null}
						>
							{localLoginInProgress === "regular"
								? "Signing in..."
								: "Continue as regular user"}
						</Button>
					</div>
				)}

				{message && (
					<p className="w-full rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-center text-destructive">
						{message}
					</p>
				)}
			</Card>
		</div>
	);
}
