import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
	type AuthorizationRequest,
	type ConsentDecision,
	fetchAuthorizationRequest,
	oauthQueryKeys,
	submitConsentDecision,
} from "@/features/oauth/oauthApi";
import {
	describeRedirectTarget,
	isFollowableRedirect,
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
	| {
			status: "consent";
			request: Extract<AuthorizationRequest, { kind: "consent" }>;
			redirectTarget: RedirectTarget;
	  };

export interface UseOAuthConsentOptions {
	/** Leaves the page for the app. Tests replace it; jsdom can't navigate. */
	redirect?: (url: string) => void;
}

const UNSAFE_REDIRECT_MESSAGE =
	"This app asked to be sent to an address that isn't allowed, so the connection was stopped.";

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
 */
export function useOAuthConsent({
	redirect = followRedirect,
}: UseOAuthConsentOptions = {}) {
	const { search } = useLocation();
	const authorizationId = readAuthorizationId(search);
	const [redirecting, setRedirecting] = useState(false);
	const [redirectError, setRedirectError] = useState<string | null>(null);

	// A logged-out visit remembered this URL to resume it after sign-in.
	// Forget it now, so a later visit doesn't reopen a used request.
	useEffect(() => {
		consumePostLoginPath();
	}, []);

	const leaveFor = useCallback(
		(url: string) => {
			if (!isFollowableRedirect(url)) {
				setRedirectError(UNSAFE_REDIRECT_MESSAGE);
				return;
			}
			setRedirecting(true);
			redirect(url);
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
		if (request?.kind === "redirect") {
			leaveFor(request.redirectUrl);
		}
	}, [request, leaveFor]);

	const decision = useMutation({
		mutationFn: (choice: ConsentDecision) =>
			submitConsentDecision(authorizationId ?? "", choice),
		onSuccess: leaveFor,
	});

	let state: OAuthConsentState;
	if (authorizationId === null) {
		state = { status: "missing-request" };
	} else if (redirectError !== null) {
		state = { status: "error", message: redirectError };
	} else if (redirecting) {
		state = { status: "redirecting" };
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
		approve: () => decision.mutate("approve"),
		deny: () => decision.mutate("deny"),
		// Signing out shows the sign-in page on this same URL, which remembers
		// it and returns here after the next sign-in.
		switchAccount: () => {
			void supabase.auth.signOut();
		},
	};
}
