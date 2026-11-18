import type { User } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { useProfileForm } from "./useProfileForm";

// Unlike useProfileForm.test.tsx, the data hooks are real here: the tests run
// the whole save and reload round trip against a stateful fake backend, which
// is what issue #397 (profile values missing after a save) is about.

const showToast = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: async () => ({ data: { session: { access_token: "t" } } }),
			signOut: vi.fn(),
		},
	},
}));
vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));
vi.mock("@/hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));
vi.mock("@/hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({ researchProjects: [], isLoading: false }),
}));
vi.mock("@/hooks/useMemberConsents", () => ({
	useMemberConsents: () => ({ consents: undefined }),
}));

const USER_ID = "user-1";

function makeUser(): User {
	return {
		id: USER_ID,
		email: "ada@tum.ai",
		user_metadata: {},
	} as unknown as User;
}

// What `handle_new_user` leaves behind for a fresh account.
function newMemberRow(): Record<string, unknown> {
	return {
		user_id: USER_ID,
		given_name: "",
		surname: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		salutation: "",
		title: null,
		batch: null,
		active: true,
		member_status: "active",
		member_role: "Member",
		department: null,
		email: "ada@tum.ai",
	};
}

interface Backend {
	row: Record<string, unknown>;
	sepa: Record<string, unknown>;
	memberPuts: Record<string, unknown>[];
}

function installBackend(initial: Record<string, unknown> = newMemberRow()) {
	const backend: Backend = {
		row: initial,
		sepa: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
		},
		memberPuts: [],
	};
	server.use(
		http.get(`/api/members/${USER_ID}`, () => HttpResponse.json(backend.row)),
		http.put(`/api/members/${USER_ID}`, async ({ request }) => {
			const body = (await request.json()) as Record<string, unknown>;
			backend.memberPuts.push(body);
			backend.row = { ...backend.row, ...body };
			return HttpResponse.json(backend.row);
		}),
		http.get(`/api/sepa/${USER_ID}`, () => HttpResponse.json(backend.sepa)),
		http.put(`/api/sepa/${USER_ID}`, async ({ request }) => {
			backend.sepa = {
				...backend.sepa,
				...((await request.json()) as Record<string, unknown>),
			};
			return HttpResponse.json(backend.sepa);
		}),
	);
	return backend;
}

function createWrapper() {
	// Production defaults that matter here: every refetch trigger is on.
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
		},
	});
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
	return { queryClient, wrapper };
}

async function renderLoaded(
	wrapper: ({ children }: { children: ReactNode }) => ReactNode,
) {
	const hook = renderHook(({ user }) => useProfileForm(user), {
		wrapper,
		initialProps: { user: makeUser() },
	});
	await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
	await waitFor(() =>
		expect(hook.result.current.memberForm.getValues("user_id")).toBe(USER_ID),
	);
	return hook;
}

function fillRequiredFields(
	form: ReturnType<typeof useProfileForm>["memberForm"],
) {
	form.setValue("given_name", "Ada", { shouldDirty: true });
	form.setValue("surname", "Lovelace", { shouldDirty: true });
	form.setValue("date_of_birth", "2000-01-02", { shouldDirty: true });
	form.setValue("street", "Main St", { shouldDirty: true });
	form.setValue("number", "1", { shouldDirty: true });
	form.setValue("postal_code", "80333", { shouldDirty: true });
	form.setValue("city", "Munich", { shouldDirty: true });
	form.setValue("country", "Germany", { shouldDirty: true });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("useProfileForm save round trip (#397)", () => {
	it("keeps salutation and batch after saving and remounting the page", async () => {
		const backend = installBackend();
		const { wrapper } = createWrapper();

		const first = await renderLoaded(wrapper);
		act(() => {
			const form = first.result.current.memberForm;
			fillRequiredFields(form);
			form.setValue("salutation", "Mr.", { shouldDirty: true });
			form.setValue("batch", "WS25", { shouldDirty: true });
		});
		await act(async () => {
			await first.result.current.onSubmit();
		});

		expect(showToast).toHaveBeenCalledWith(
			"Profile saved successfully!",
			"success",
		);
		expect(backend.row.salutation).toBe("Mr.");
		expect(backend.row.batch).toBe("WS25");
		// Everything the form holds is now what the server has.
		expect(first.result.current.isDirty).toBe(false);

		// Switching to another page and back remounts the profile page.
		first.unmount();
		const second = await renderLoaded(wrapper);

		expect(second.result.current.memberForm.getValues("salutation")).toBe(
			"Mr.",
		);
		expect(second.result.current.memberForm.getValues("batch")).toBe("WS25");
		expect(second.result.current.isDirty).toBe(false);
	});
});

describe("useProfileForm partial saves (#397)", () => {
	it("keeps the saved profile and names the bank details when only those fail", async () => {
		const backend = installBackend();
		server.use(
			http.put(`/api/sepa/${USER_ID}`, () =>
				HttpResponse.json({ error: "Invalid IBAN" }, { status: 400 }),
			),
		);
		const { wrapper } = createWrapper();
		const hook = await renderLoaded(wrapper);

		act(() => {
			const form = hook.result.current.memberForm;
			fillRequiredFields(form);
			form.setValue("salutation", "Mr.", { shouldDirty: true });
			hook.result.current.sepaForm.setValue("iban", "DE89370400440532013000", {
				shouldDirty: true,
			});
			hook.result.current.sepaForm.setValue("bank_name", "Bank", {
				shouldDirty: true,
			});
			hook.result.current.sepaForm.setValue("mandate_agreed", true, {
				shouldDirty: true,
			});
			hook.result.current.sepaForm.setValue("privacy_agreed", true, {
				shouldDirty: true,
			});
		});
		await act(async () => {
			await hook.result.current.onSubmit();
		});

		expect(backend.row.salutation).toBe("Mr.");
		expect(showToast).toHaveBeenCalledWith(
			"Profile saved, but your bank details were not: Invalid IBAN",
			"error",
		);
		// The bank details were not saved, so the page still has unsaved changes.
		expect(hook.result.current.isDirty).toBe(true);
		expect(hook.result.current.sepaForm.getValues("bank_name")).toBe("Bank");
	});
});

describe("useProfileForm unsaved edits (#397)", () => {
	it("keeps unsaved edits when the auth session emits a new user object", async () => {
		installBackend();
		const { wrapper } = createWrapper();
		const hook = await renderLoaded(wrapper);

		act(() => {
			hook.result.current.memberForm.setValue("salutation", "Ms.", {
				shouldDirty: true,
			});
			hook.result.current.memberForm.setValue("city", "Munich", {
				shouldDirty: true,
			});
		});

		// Returning to the tab makes supabase-js emit SIGNED_IN again, and App
		// then stores a new object for the same user.
		hook.rerender({ user: makeUser() });
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(hook.result.current.memberForm.getValues("salutation")).toBe("Ms.");
		expect(hook.result.current.memberForm.getValues("city")).toBe("Munich");
		expect(hook.result.current.isDirty).toBe(true);
	});

	it("keeps unsaved edits across a window-focus refetch with unchanged data", async () => {
		installBackend();
		const { wrapper, queryClient } = createWrapper();
		const hook = await renderLoaded(wrapper);

		act(() => {
			hook.result.current.memberForm.setValue("batch", "SS24", {
				shouldDirty: true,
			});
			hook.result.current.sepaForm.setValue("bank_name", "Test Bank", {
				shouldDirty: true,
			});
		});

		await act(async () => {
			await queryClient.refetchQueries();
		});

		expect(hook.result.current.memberForm.getValues("batch")).toBe("SS24");
		expect(hook.result.current.sepaForm.getValues("bank_name")).toBe(
			"Test Bank",
		);
	});

	it("takes new server data for untouched fields but keeps edited ones", async () => {
		const backend = installBackend();
		const { wrapper, queryClient } = createWrapper();
		const hook = await renderLoaded(wrapper);

		act(() => {
			hook.result.current.memberForm.setValue("salutation", "Mx.", {
				shouldDirty: true,
			});
		});

		// Another tab (or an admin) changed the city in the meantime.
		backend.row = { ...backend.row, city: "Berlin" };
		await act(async () => {
			await queryClient.refetchQueries();
		});

		await waitFor(() =>
			expect(hook.result.current.memberForm.getValues("city")).toBe("Berlin"),
		);
		expect(hook.result.current.memberForm.getValues("salutation")).toBe("Mx.");
	});

	it("shows the current batch as an unsaved suggestion for a member without one", async () => {
		installBackend();
		const { wrapper } = createWrapper();
		const hook = await renderLoaded(wrapper);

		expect(hook.result.current.memberForm.getValues("batch")).toBeTruthy();
		expect(hook.result.current.isDirty).toBe(true);
	});
});
