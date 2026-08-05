import type {
	EducationalCourseApplication,
	EducationalCoursePeriod,
	EducationalCourseRole,
} from "@member-manager/shared";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderHookWithClient } from "@/test/renderWithClient";
import { useEducationalCourses } from "./useEducationalCourses";

const showToast = vi.fn();
const accessState = vi.hoisted(() => ({
	educationalCourseRole: "participant" as EducationalCourseRole | null,
}));

vi.mock("../../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../../hooks/useToolAccess", () => ({
	useToolAccess: () => ({
		educationalCourseRole: accessState.educationalCourseRole,
		permissions: [],
		isBoardMember: false,
		department: null,
		isLoading: false,
	}),
}));

vi.mock("../../../hooks/use-mobile", () => ({
	useIsMobile: () => false,
}));

vi.mock("../../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
		},
	},
}));

function makeApplication(
	overrides: Partial<EducationalCourseApplication> = {},
): EducationalCourseApplication {
	return {
		id: "10000000-0000-4000-8000-000000000001",
		periodId: "20000000-0000-4000-8000-000000000001",
		userId: "30000000-0000-4000-8000-000000000001",
		givenName: "Regular",
		surname: "Member",
		status: "pending",
		reviewedAt: null,
		createdAt: "2026-08-01T12:00:00.000Z",
		updatedAt: "2026-08-01T12:00:00.000Z",
		...overrides,
	};
}

function makePeriod(
	overrides: Partial<EducationalCoursePeriod> = {},
): EducationalCoursePeriod {
	return {
		id: "20000000-0000-4000-8000-000000000001",
		startsOn: "2027-02-01",
		endsOn: "2027-02-07",
		capacity: 2,
		applicationsOpen: true,
		approvedParticipants: [],
		myApplication: null,
		createdAt: "2026-08-01T12:00:00.000Z",
		updatedAt: "2026-08-01T12:00:00.000Z",
		...overrides,
	};
}

describe("useEducationalCourses", () => {
	beforeEach(() => {
		showToast.mockClear();
		accessState.educationalCourseRole = "participant";
	});

	it("loads periods and applies as the authenticated participant", async () => {
		let period = makePeriod();
		server.use(
			http.get("/api/education/periods", () =>
				HttpResponse.json({ periods: [period] }),
			),
			http.post("/api/education/periods/:periodId/applications", () => {
				const application = makeApplication();
				period = { ...period, myApplication: application };
				return HttpResponse.json(application, { status: 201 });
			}),
		);

		const { result } = renderHookWithClient(() => useEducationalCourses());
		await waitFor(() => expect(result.current.periods).toHaveLength(1));

		act(() => result.current.apply(period.id));

		await waitFor(() =>
			expect(result.current.periods[0].myApplication?.status).toBe("pending"),
		);
		expect(showToast).toHaveBeenCalledWith("Application submitted.", "success");
	});

	it("creates a custom range with administrator selected capacity", async () => {
		accessState.educationalCourseRole = "administrator";
		let submitted: unknown = null;
		const created = makePeriod({
			startsOn: "2027-03-10",
			endsOn: "2027-03-18",
			capacity: 4,
		});
		server.use(
			http.get("/api/education/periods", () =>
				HttpResponse.json({ periods: [] }),
			),
			http.get("/api/education/participants", () =>
				HttpResponse.json({ participants: [] }),
			),
			http.get("/api/education/periods/:periodId", () =>
				HttpResponse.json({ period: created, applications: [] }),
			),
			http.post("/api/education/periods", async ({ request }) => {
				submitted = await request.json();
				return HttpResponse.json(created, { status: 201 });
			}),
		);

		const { result } = renderHookWithClient(() => useEducationalCourses());
		await waitFor(() => expect(result.current.isLoadingPeriods).toBe(false));

		await act(async () => {
			await result.current.createPeriod({
				startsOn: "2027-03-10",
				endsOn: "2027-03-18",
				capacity: 4,
			});
		});

		await waitFor(() => expect(submitted).not.toBeNull());
		expect(submitted).toEqual({
			startsOn: "2027-03-10",
			endsOn: "2027-03-18",
			capacity: 4,
		});
		expect(showToast).toHaveBeenCalledWith("Course period created.", "success");
	});

	it("searches only the scoped participant candidates", async () => {
		accessState.educationalCourseRole = "administrator";
		let requestedSearch = "";
		server.use(
			http.get("/api/education/periods", () =>
				HttpResponse.json({ periods: [] }),
			),
			http.get("/api/education/participants", () =>
				HttpResponse.json({ participants: [] }),
			),
			http.get("/api/education/participant-candidates", ({ request }) => {
				requestedSearch = new URL(request.url).searchParams.get("search") ?? "";
				return HttpResponse.json({
					candidates: [
						{
							userId: "30000000-0000-4000-8000-000000000002",
							givenName: "Taylor",
							surname: "Member",
							email: "taylor@example.com",
						},
					],
				});
			}),
		);

		const { result } = renderHookWithClient(() => useEducationalCourses());
		await waitFor(() =>
			expect(result.current.isLoadingParticipants).toBe(false),
		);

		act(() => result.current.setParticipantSearch("Taylor"));

		await waitFor(() =>
			expect(result.current.eligibleMembers).toEqual([
				{
					userId: "30000000-0000-4000-8000-000000000002",
					givenName: "Taylor",
					surname: "Member",
					email: "taylor@example.com",
				},
			]),
		);
		expect(requestedSearch).toBe("Taylor");
	});

	it("does not search participant candidates for a one-character query", async () => {
		accessState.educationalCourseRole = "administrator";
		let candidateRequests = 0;
		server.use(
			http.get("/api/education/periods", () =>
				HttpResponse.json({ periods: [] }),
			),
			http.get("/api/education/participants", () =>
				HttpResponse.json({ participants: [] }),
			),
			http.get("/api/education/participant-candidates", () => {
				candidateRequests += 1;
				return HttpResponse.json({ candidates: [] });
			}),
		);

		const { result } = renderHookWithClient(() => useEducationalCourses());
		await waitFor(() =>
			expect(result.current.isLoadingParticipants).toBe(false),
		);

		act(() => result.current.setParticipantSearch("T"));
		await new Promise((resolve) => window.setTimeout(resolve, 300));

		expect(candidateRequests).toBe(0);
		expect(result.current.eligibleMembers).toEqual([]);
	});

	it("sends administrator review decisions", async () => {
		accessState.educationalCourseRole = "administrator";
		const period = makePeriod();
		const application = makeApplication();
		let body: unknown = null;
		server.use(
			http.get("/api/education/periods", () =>
				HttpResponse.json({ periods: [period] }),
			),
			http.get("/api/education/participants", () =>
				HttpResponse.json({ participants: [] }),
			),
			http.get("/api/education/periods/:periodId", () =>
				HttpResponse.json({ period, applications: [application] }),
			),
			http.patch(
				"/api/education/applications/:applicationId",
				async ({ request }) => {
					body = await request.json();
					return HttpResponse.json({ ...application, status: "approved" });
				},
			),
		);

		const { result } = renderHookWithClient(() => useEducationalCourses());
		await waitFor(() =>
			expect(result.current.selectedPeriodDetail).not.toBeNull(),
		);

		act(() =>
			result.current.reviewApplication(application.id, period.id, "approved"),
		);
		await waitFor(() => expect(body).toEqual({ decision: "approved" }));
	});
});
