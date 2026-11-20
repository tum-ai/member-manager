import type { ProfileResponse } from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { type UseProfileFormResult, useProfileForm } from "./useProfileForm";

const showToast = vi.fn();
let isAdmin = false;
let researchProjects: unknown[] = [];

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));
vi.mock("@/hooks/useIsAdmin", () => ({
	useIsAdmin: () => ({ isAdmin, isLoading: false }),
}));
vi.mock("@/hooks/useResearchProjects", () => ({
	useResearchProjects: () => ({ researchProjects, isLoading: false }),
}));
vi.mock("@/hooks/useMemberConsents", () => ({
	useMemberConsents: () => ({ consents: undefined }),
}));
vi.mock("@/lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const user = {
	id: "user-1",
	email: "ada@tum.ai",
	user_metadata: { given_name: "Ada", family_name: "Lovelace" },
} as unknown as User;

const noBank = {
	iban: "",
	bic: "",
	bank_name: "",
	mandate_agreed: false,
	privacy_agreed: false,
	data_privacy_notice_agreed: false,
};
const savedBank = {
	iban: "DE89370400440532013000",
	bic: "COBADEFFXXX",
	bank_name: "Test Bank",
	mandate_agreed: true,
	privacy_agreed: true,
	data_privacy_notice_agreed: true,
};

function makeProfile(
	overrides: {
		version?: number;
		member?: Record<string, unknown>;
		sepa?: Partial<ProfileResponse["sepa"]>;
		completeness?: ProfileResponse["completeness"];
	} = {},
): ProfileResponse {
	return {
		version: overrides.version ?? 4,
		member: {
			user_id: "user-1",
			email: "ada@tum.ai",
			given_name: "Ada",
			surname: "Lovelace",
			batch: "WS25",
			city: "Munich",
			...overrides.member,
		},
		sepa: { ...noBank, ...overrides.sepa },
		completeness: overrides.completeness ?? {
			percent: 40,
			missing: ["IBAN"],
		},
	};
}

type PutBody = {
	version: number;
	member: Record<string, unknown>;
	sepa: Record<string, unknown>;
};

let currentProfile: ProfileResponse;
let putBodies: PutBody[];
let putResponse: () => Response;

beforeEach(() => {
	vi.clearAllMocks();
	isAdmin = false;
	researchProjects = [];
	currentProfile = makeProfile();
	putBodies = [];
	putResponse = () => HttpResponse.json(currentProfile);
	server.use(
		http.get("/api/profile/user-1", () => HttpResponse.json(currentProfile)),
		http.put("/api/profile/user-1", async ({ request }) => {
			putBodies.push((await request.json()) as PutBody);
			return putResponse();
		}),
	);
});

async function renderLoaded(currentUser: User = user) {
	const rendered = renderHookWithClient(
		({ u }: { u: User }) => useProfileForm(u),
		{ initialProps: { u: currentUser } },
	);
	await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
	await waitFor(() =>
		expect(rendered.result.current.form.getValues("given_name")).not.toBe(""),
	);
	return rendered;
}

async function submit(result: { current: UseProfileFormResult }) {
	await act(async () => {
		await result.current.onSubmit();
	});
}

function dirty(
	result: { current: UseProfileFormResult },
	changes: Record<string, string | boolean>,
) {
	act(() => {
		for (const [name, value] of Object.entries(changes)) {
			result.current.form.setValue(name as never, value as never, {
				shouldDirty: true,
			});
		}
	});
}

describe("useProfileForm", () => {
	it("stays loading until the profile has loaded", async () => {
		const { result } = renderHookWithClient(() => useProfileForm(user));
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("hydrates the form and the completeness from the stored profile", async () => {
		currentProfile = makeProfile({
			member: { linkedin_profile_url: "https://linkedin.com/in/ada" },
			sepa: savedBank,
			completeness: { percent: 88, missing: ["TUM.ai batch"] },
		});
		const { result } = await renderLoaded();

		expect(result.current.form.getValues("city")).toBe("Munich");
		expect(result.current.form.getValues("iban")).toBe(
			"DE89370400440532013000",
		);
		expect(result.current.form.getValues("linkedin_profile_url")).toBe(
			"https://linkedin.com/in/ada",
		);
		expect(result.current.completeness).toBe(88);
		expect(result.current.missingProfileFields).toEqual(["TUM.ai batch"]);
	});

	it("offers Slack and batch suggestions only where nothing is stored", async () => {
		currentProfile = makeProfile({
			member: { given_name: "", surname: "", batch: null },
		});
		const { result } = await renderLoaded();

		expect(result.current.form.getValues("given_name")).toBe("Ada");
		expect(result.current.form.getValues("surname")).toBe("Lovelace");
		expect(result.current.suggestedFields).toEqual([
			"given_name",
			"surname",
			"batch",
		]);
		// Suggestions do not raise the stored completeness.
		expect(result.current.completeness).toBe(40);
	});

	describe("unsaved edits survive background updates (#397)", () => {
		it("keeps typed values when the auth user object is re-created on tab refocus", async () => {
			const { result, rerender } = await renderLoaded();

			dirty(result, { salutation: "Mrs", batch: "SS26" });
			// supabase-js re-emits SIGNED_IN with a fresh user object on focus.
			rerender({ u: { ...user } as User });

			expect(result.current.form.getValues("salutation")).toBe("Mrs");
			expect(result.current.form.getValues("batch")).toBe("SS26");
		});

		it("keeps edited fields but refreshes untouched ones when a refetch returns new data", async () => {
			const { result, queryClient } = await renderLoaded();

			dirty(result, { given_name: "Gracie" });
			currentProfile = makeProfile({
				version: 5,
				member: { given_name: "Grace", city: "Berlin" },
			});
			await act(async () => {
				await queryClient.invalidateQueries({
					queryKey: ["profile", "user-1"],
				});
			});

			await waitFor(() =>
				expect(result.current.form.getValues("city")).toBe("Berlin"),
			);
			expect(result.current.form.getValues("given_name")).toBe("Gracie");
		});
	});

	describe("saving", () => {
		it("sends one request with the version, member data and bank group", async () => {
			const { result } = await renderLoaded();

			dirty(result, { salutation: "Mrs", batch: "SS26" });
			await submit(result);

			expect(putBodies).toHaveLength(1);
			expect(putBodies[0].version).toBe(4);
			expect(putBodies[0].member).toMatchObject({
				salutation: "Mrs",
				batch: "SS26",
			});
			expect(putBodies[0].member).not.toHaveProperty("member_role");
			expect(putBodies[0].sepa).toEqual({
				iban: "",
				bic: "",
				bank_name: "",
				mandate_agreed: false,
				privacy_agreed: false,
			});
			expect(showToast).toHaveBeenCalledWith(
				"Profile saved successfully!",
				"success",
			);
		});

		it("adopts the response: new version, completeness, and a pristine form", async () => {
			const { result } = await renderLoaded();
			dirty(result, { batch: "SS26" });
			currentProfile = makeProfile({
				version: 9,
				member: { batch: "SS26" },
				completeness: { percent: 100, missing: [] },
			});

			await submit(result);

			await waitFor(() => expect(result.current.completeness).toBe(100));
			expect(result.current.form.getValues("batch")).toBe("SS26");

			// The next save carries the version from the response.
			await submit(result);
			expect(putBodies[1].version).toBe(9);
		});

		it("includes role and department for admins", async () => {
			isAdmin = true;
			const { result } = await renderLoaded();

			dirty(result, { member_role: "Member", department: "Venture" });
			await submit(result);

			expect(putBodies[0].member).toMatchObject({
				member_role: "Member",
				department: "Venture",
				research_project_id: null,
			});
		});

		it("surfaces the server error in a toast", async () => {
			putResponse = () =>
				HttpResponse.json({ error: "Database is down" }, { status: 500 });
			const { result } = await renderLoaded();

			dirty(result, { city: "Berlin" });
			await submit(result);

			expect(showToast).toHaveBeenCalledWith(
				"Error saving: Database is down",
				"error",
			);
		});
	});

	describe("validation", () => {
		it("blocks the save and toasts when required fields are missing", async () => {
			const { result } = await renderLoaded();

			dirty(result, { given_name: "", surname: "" });
			await submit(result);

			expect(putBodies).toHaveLength(0);
			expect(showToast).toHaveBeenCalledWith(
				"Please complete all required profile fields before saving.",
				"error",
			);
		});

		it("requires the whole bank group once one bank field is filled", async () => {
			const { result } = await renderLoaded();

			dirty(result, { bic: "COBADEFFXXX" });
			await submit(result);

			expect(putBodies).toHaveLength(0);
			expect(result.current.form.getFieldState("iban").error?.message).toBe(
				"Invalid IBAN",
			);
			expect(showToast).toHaveBeenCalledWith(
				"Please complete all required fields and agreements before saving.",
				"error",
			);
		});

		it("saves agreements alone when no bank details are entered", async () => {
			const { result } = await renderLoaded();

			dirty(result, { privacy_agreed: true });
			await submit(result);

			expect(putBodies[0].sepa).toMatchObject({
				iban: "",
				privacy_agreed: true,
				mandate_agreed: false,
			});
		});

		it("refuses to clear bank details that are already saved", async () => {
			currentProfile = makeProfile({ sepa: savedBank });
			const { result } = await renderLoaded();

			dirty(result, { iban: "", bic: "", bank_name: "" });
			await submit(result);

			const message =
				"Bank details can't be removed once saved — edit them instead";
			expect(putBodies).toHaveLength(0);
			expect(result.current.form.getFieldState("iban").error?.message).toBe(
				message,
			);
			expect(showToast).toHaveBeenCalledWith(message, "error");
		});

		it("still lets members edit saved bank details", async () => {
			currentProfile = makeProfile({ sepa: savedBank });
			const { result } = await renderLoaded();

			dirty(result, { iban: "GB82WEST12345698765432", bank_name: "New Bank" });
			await submit(result);

			expect(putBodies[0].sepa).toMatchObject({
				iban: "GB82WEST12345698765432",
				bank_name: "New Bank",
			});
		});
	});

	describe("a stale version (412)", () => {
		const changedElsewhere = () =>
			makeProfile({
				version: 8,
				member: { given_name: "Changed", city: "Hamburg" },
			});

		beforeEach(() => {
			putResponse = () =>
				HttpResponse.json(
					{
						error: "Your profile was changed elsewhere.",
						code: "profile_version_conflict",
						current: changedElsewhere(),
					},
					{ status: 412 },
				);
		});

		it("keeps the edits, raises a conflict and shows no error toast", async () => {
			const { result } = await renderLoaded();

			dirty(result, { given_name: "My Edit" });
			await submit(result);

			expect(result.current.conflict?.current.version).toBe(8);
			expect(result.current.form.getValues("given_name")).toBe("My Edit");
			expect(showToast).not.toHaveBeenCalled();
		});

		it("keepMyChanges adopts the new version without losing edits, and the next save uses it", async () => {
			const { result } = await renderLoaded();
			dirty(result, { given_name: "My Edit" });
			await submit(result);

			act(() => result.current.keepMyChanges());

			await waitFor(() => expect(result.current.conflict).toBeNull());
			expect(result.current.form.getValues("given_name")).toBe("My Edit");
			// Fields the member did not touch follow the latest stored version.
			await waitFor(() =>
				expect(result.current.form.getValues("city")).toBe("Hamburg"),
			);

			putResponse = () => HttpResponse.json(currentProfile);
			await submit(result);
			expect(putBodies.at(-1)?.version).toBe(8);
		});

		it("reloadLatest discards the edits and shows what is stored", async () => {
			const { result } = await renderLoaded();
			dirty(result, { given_name: "My Edit" });
			await submit(result);

			act(() => result.current.reloadLatest());

			await waitFor(() => expect(result.current.conflict).toBeNull());
			expect(result.current.form.getValues("given_name")).toBe("Changed");
			expect(result.current.form.getValues("city")).toBe("Hamburg");
		});
	});

	it("derives the research department state from the live form", async () => {
		researchProjects = [
			{ id: "rp-active", title: "Active", status: "ongoing" },
			{ id: "rp-done", title: "Done", status: "completed" },
			{ id: "rp-blank", title: "Blank", status: "" },
		];
		const { result } = await renderLoaded();

		expect(result.current.researchProjectOptions.map((p) => p.id)).toEqual([
			"rp-active",
			"rp-blank",
		]);
		expect(result.current.isResearchDepartmentSelected).toBe(false);

		dirty(result, { department: "Research" });
		await waitFor(() =>
			expect(result.current.isResearchDepartmentSelected).toBe(true),
		);
	});

	it("exposes a load error instead of an editable empty form", async () => {
		server.use(
			http.get("/api/profile/user-1", () =>
				HttpResponse.json({ error: "Boom" }, { status: 500 }),
			),
		);
		const { result } = renderHookWithClient(() => useProfileForm(user));

		await waitFor(() => expect(result.current.loadError).not.toBeNull());
		expect(result.current.loadError?.message).toBe("Boom");
	});
});
