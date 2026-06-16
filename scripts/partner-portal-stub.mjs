// Local-only stub of the Partner Portal internal job-requests API.
// Lets the admin Job Posting Requests page show a partner-sourced card.
// Run: node scripts/partner-portal-stub.mjs  (listens on :4505)
import { createServer } from "node:http";

const PORT = Number(process.env.PARTNER_STUB_PORT) || 4505;

const partnerJobs = [
	{
		id: "stub-partner-1",
		user_id: "partner-portal",
		status: "pending",
		title: "Senior Robotics Engineer",
		organization_name: "Acme Robotics GmbH",
		logo_url: null,
		description_markdown:
			"Join **Acme Robotics** to build autonomous systems.\n\n- ROS2 + C++\n- On-site in Munich",
		call_to_action: "Apply now",
		job_type: "full_time",
		location: "Munich",
		contact_name: "Dana Partner",
		contact_email: "dana@acme-robotics.example",
		contact_role: "Talent Lead",
		external_url: "https://acme-robotics.example/careers/robotics",
		expires_at: null,
		published_at: null,
		review_note: null,
		created_at: "2026-06-16T00:00:00.000Z",
	},
];

const server = createServer((req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	res.setHeader("content-type", "application/json");

	// List endpoint the member-manager server polls.
	if (
		req.method === "GET" &&
		url.pathname === "/api/internal/member-manager/job-requests"
	) {
		res.statusCode = 200;
		res.end(JSON.stringify(partnerJobs));
		return;
	}

	// Review (approve/reject) — PATCH /.../job-requests/:id
	if (
		req.method === "PATCH" &&
		url.pathname.startsWith("/api/internal/member-manager/job-requests/")
	) {
		res.statusCode = 200;
		res.end(JSON.stringify({ ok: true }));
		return;
	}

	// Remove — DELETE /.../job-requests/:id
	if (
		req.method === "DELETE" &&
		url.pathname.startsWith("/api/internal/member-manager/job-requests/")
	) {
		res.statusCode = 200;
		res.end(JSON.stringify({ ok: true }));
		return;
	}

	res.statusCode = 404;
	res.end(JSON.stringify({ error: "not found", path: url.pathname }));
});

server.listen(PORT, () => {
	console.log(`partner-portal stub listening on http://localhost:${PORT}`);
});
