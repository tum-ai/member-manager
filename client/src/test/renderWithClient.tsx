import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	type RenderHookOptions,
	type RenderHookResult,
	type RenderOptions,
	type RenderResult,
	render,
	renderHook,
} from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";

/**
 * A QueryClient tuned for tests: no retries (so rejected queries surface the
 * error immediately) and no cache retention between renders (gcTime 0).
 */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: PropsWithChildren): ReactElement {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

/**
 * Render a component tree wrapped in a fresh QueryClientProvider. Returns the
 * usual RTL result plus the `queryClient` so tests can assert on the cache.
 */
export function renderWithClient(
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient },
): RenderResult & { queryClient: QueryClient } {
	const queryClient = options?.queryClient ?? createTestQueryClient();
	const result = render(ui, {
		wrapper: createWrapper(queryClient),
		...options,
	});
	return { ...result, queryClient };
}

/**
 * `renderHook` variant that provides a QueryClientProvider, for testing hooks
 * that use TanStack Query directly.
 */
export function renderHookWithClient<Result, Props>(
	hook: (initialProps: Props) => Result,
	options?: Omit<RenderHookOptions<Props>, "wrapper"> & {
		queryClient?: QueryClient;
	},
): RenderHookResult<Result, Props> & { queryClient: QueryClient } {
	const queryClient = options?.queryClient ?? createTestQueryClient();
	const result = renderHook(hook, {
		wrapper: createWrapper(queryClient),
		...options,
	});
	return { ...result, queryClient };
}
