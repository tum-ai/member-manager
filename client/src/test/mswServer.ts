import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

// Default handlers return empty/benign payloads so any `/api/*` request a hook
// fires during a render resolves instead of tripping `onUnhandledRequest: "error"`.
// Individual tests override the routes they care about via `server.use(...)`.
// CAUTION: a test that asserts against a default handler is asserting against an
// empty stub, not a real response shape — always `server.use(...)` the route you
// actually exercise so a green test reflects real data flow.
const defaultHandlers = [
	http.get("/api/reimbursements", () => HttpResponse.json([])),
	http.get("/api/reimbursements/review", () => HttpResponse.json([])),
	http.get("/api/reimbursements/review/integrations", () =>
		HttpResponse.json({}),
	),
	http.get("/api/contracts/templates", () => HttpResponse.json([])),
	http.get("/api/contracts/submissions", () => HttpResponse.json([])),
	http.get("/api/admin/members", () =>
		HttpResponse.json({ data: [], total: 0, page: 1, limit: 200 }),
	),
	http.get("/api/admin/member-change-requests", () => HttpResponse.json([])),
	http.get("/api/admin/engagement-certificate-requests", () =>
		HttpResponse.json([]),
	),
	http.get("/api/admin/job-requests", () => HttpResponse.json([])),
];

export const server = setupServer(...defaultHandlers);

// Re-export the request-mocking primitives so tests import everything from one
// place instead of reaching into `msw` directly.
export { HttpResponse, http };
