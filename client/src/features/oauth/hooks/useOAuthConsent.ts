import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
	type AuthorizationRequest,
	bindAuthorization,
	type ConsentDecision,
	fetchAuthorizationRequest,
	oauthQueryKeys,
	submitConsentDecision,
} from "@/features/oauth/oauthApi";
import {
	describeRedirectTarget,
	type RedirectTarget,
	readAuthorizationId,
} from "@/features/oauth/oauthUtils";
import { consumePostLoginPath } from "@/lib/postLoginRedirect";
import { supabase } from "@/lib/supabaseClient";

export type OAuthConsentState =
	| { status: "missing-request" }
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "redirecting" }
	/**
	 * Supabase returned a redirect (with a code) for an app the member approved
	 * earlier, but it points somewhere that isn't an approved MCP client, e.g.
	 * a second redirect URI registered next to an approved one.
	 */
	| { status: "refused"; redirectLabel: string }
	/**
	 * An app the member approved earlier asked again, but it can't be bound to
	 * the TUM.ai server it asked for (it is bound to another one, or named
	 * none), so its code isn't handed over.
	 */
	| { status: "unbound"; message: string }
	/** The member denied an app that isn't approved; it isn't visited. */
	| { status: "denied" }
	| {
			/** `redirectTarget.isApproved` false: the member can only deny. */
			status: "consent";
			request: Extract<AuthorizationRequest, { kind: "consent" }>;
			redirectTarget: RedirectTarget;
	  };

export interface UseOAuthConsentOptions {
	/** Leaves the page for the app. Tests replace it; jsdom can't navigate. */
	redirect?: (url: string) => void;
}

type Exit =
	| { kind: "redirecting" }
	| { kind: "refused"; redirectLabel: string }
	| { kind: "unbound"; message: string }
	| { kind: "denied" };

function followRedirect(url: string): void {
	window.location.assign(url);
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: "Something went wrong.";
}

/**
 * State and actions for the OAuth consent page: loads the authorization
 * request from `?authorization_id=`, then records the member's decision and
 * hands the browser back to the app.
 *
 * Only apps whose redirect URI is an approved MCP client
 * (`APPROVED_MCP_CLIENT_REDIRECTS`) can be approved, and the browser only
 * follows a redirect to an approved address. A denial for any other app is
 * recorded without sending the member there.
 *
 * Before approving, and before following the redirect of an app approved
 * earlier, the app is bound to the TUM.ai MCP server it asked for
 * (`bindAuthorization`). If that fails, nothing is approved and the browser
 * stays here with the reason.
 */
export function useOAuthConsent({
	redirect = followRedirect,
}: UseOAuthConsentOptions = {}) {
	const { search } = useLocation();
	const authorizationId = readAuthorizationId(search);
	const [exit, setExit] = useState<Exit | null>(null);
	// The redirect already being bound, so a re-render doesn't bind twice.
	const boundRedirect = useRef<string | null>(null);

	// A logged-out visit remembered this URL to resume it after sign-in.
	// Forget it now, so a later visit doesn't reopen a used request.
	useEffect(() => {
		consumePostLoginPath();
	}, []);

	const leaveFor = useCallback(
		(url: string, outcome: "approved" | "denied") => {
			const target = describeRedirectTarget(url);
			if (target.isApproved) {
				setExit({ kind: "redirecting" });
				redirect(url);
			} else if (outcome === "denied") {
				setExit({ kind: "denied" });
			} else {
				// Never hand a code to an address that isn't an approved client.
				setExit({ kind: "refused", redirectLabel: target.label });
			}
		},
		[redirect],
	);

	const requestQuery = useQuery({
		queryKey: oauthQueryKeys.authorization(authorizationId),
		queryFn: () => fetchAuthorizationRequest(authorizationId ?? ""),
		enabled: authorizationId !== null,
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});
	const request = requestQuery.data;

	useEffect(() => {
		if (request?.kind !== "redirect") return;
		const url = request.redirectUrl;
		if (!describeRedirectTarget(url).isApproved) {
			leaveFor(url, "approved");
			return;
		}
		if (boundRedirect.current === url) return;
		boundRedirect.current = url;
		bindAuthorization(authorizationId ?? "").then(
			() => leaveFor(url, "approved"),
			(error: unknown) =>
				setExit({ kind: "unbound", message: errorMessage(error) }),
		);
	}, [request, leaveFor, authorizationId]);

	const decision = useMutation({
		mutationFn: async (choice: ConsentDecision) => {
			if (choice === "approve") {
				await bindAuthorization(authorizationId ?? "");
			}
			return submitConsentDecision(authorizationId ?? "", choice);
		},
		onSuccess: (redirectUrl, choice) =>
			leaveFor(redirectUrl, choice === "approve" ? "approved" : "denied"),
	});

	let state: OAuthConsentState;
	if (authorizationId === null) {
		state = { status: "missing-request" };
	} else if (exit?.kind === "redirecting") {
		state = { status: "redirecting" };
	} else if (exit?.kind === "refused") {
		state = { status: "refused", redirectLabel: exit.redirectLabel };
	} else if (exit?.kind === "unbound") {
		state = { status: "unbound", message: exit.message };
	} else if (exit?.kind === "denied") {
		state = { status: "denied" };
	} else if (requestQuery.isError) {
		state = { status: "error", message: errorMessage(requestQuery.error) };
	} else if (!request || request.kind === "redirect") {
		state = { status: "loading" };
	} else {
		state = {
			status: "consent",
			request,
			redirectTarget: describeRedirectTarget(request.redirectUri),
		};
	}

	return {
		state,
		pendingDecision: decision.isPending ? decision.variables : null,
		decisionError: decision.isError ? errorMessage(decision.error) : null,
		approve: () => {
			if (state.status === "consent" && state.redirectTarget.isApproved) {
				decision.mutate("approve");
			}
		},
		deny: () => decision.mutate("deny"),
		// Signing out shows the sign-in page on this same URL, which remembers
		// it and returns here after the next sign-in.
		switchAccount: () => {
			void supabase.auth.signOut();
		},
	};
}
