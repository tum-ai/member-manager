import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { InnovationProject, Member } from "../../types";
import ProjectsView from "./ProjectsView";

function buildMember(overrides: Partial<Member>): Member {
	return {
		active: true,
		salutation: "",
		title: "",
		surname: "Example",
		given_name: "Member",
		email: "",
		date_of_birth: "",
		street: "",
		number: "",
		postal_code: "",
		city: "",
		country: "",
		user_id: crypto.randomUUID(),
		member_status: "active",
		...overrides,
	};
}

describe("ProjectsView", () => {
	it("renders research projects with their members", () => {
		render(
			<ProjectsView
				members={[
					buildMember({
						user_id: "research-lead",
						given_name: "Lea",
						surname: "Research",
						department: "Research",
						member_role: "Team Lead",
						research_project_id: "project-a",
					}),
					buildMember({
						user_id: "research-member",
						given_name: "Riley",
						surname: "Research",
						department: "Research",
						member_role: "Member",
						research_project_id: "project-a",
					}),
				]}
				researchProjects={[
					{
						id: "project-a",
						title: "Alpha Research",
						description: "Current project",
						status: "ongoing",
					},
				]}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: /projects/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Alpha Research")).toBeInTheDocument();
		expect(screen.getAllByText("Lea Research").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Riley Research").length).toBeGreaterThan(0);
	});

	it("does not render unresolved internal research references as card titles", () => {
		render(
			<ProjectsView
				members={[
					buildMember({
						user_id: "research-member",
						given_name: "Riley",
						surname: "Research",
						department: "Research",
						member_role: "Member",
						research_project_id: "29b7306b-fd62-805d-8e47-fbe49a5443d4",
					}),
				]}
			/>,
		);

		expect(screen.getByText("Unmatched Research Project")).toBeInTheDocument();
		expect(
			screen.queryByText("29b7306b-fd62-805d-8e47-fbe49a5443d4"),
		).not.toBeInTheDocument();
		expect(screen.getByText("Riley Research")).toBeInTheDocument();
	});

	it("renders innovation projects and expands details on click", async () => {
		const user = userEvent.setup();
		const innovationProjects: InnovationProject[] = [
			{
				id: "women-at-tumai",
				title: "Women@TUM.ai",
				description: "Female empowerment, mentorship, and leadership.",
				detailedDescription:
					"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative.",
				image: "/assets/innovation/women_at_tumai.jpg",
			},
		];

		render(
			<ProjectsView
				members={[
					buildMember({
						user_id: "innovation-lead",
						given_name: "Iris",
						surname: "Innovation",
						department: "Marketing",
						member_role: "Member",
						innovation_project_id: "women-at-tumai",
						innovation_project_role: "Lead",
					}),
					buildMember({
						user_id: "innovation-member",
						given_name: "Ivan",
						surname: "Innovation",
						department: "Software Development",
						member_role: "Team Lead",
						innovation_project_id: "women-at-tumai",
					}),
				]}
				innovationProjects={innovationProjects}
			/>,
		);

		expect(screen.getByText("Innovation Projects")).toBeInTheDocument();
		expect(screen.getByText("Women@TUM.ai")).toBeInTheDocument();
		expect(
			screen.queryByText(
				"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative.",
			),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Iris Innovation")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /women@tum\.ai/i }));

		expect(
			screen.getByText(
				"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Project Leads")).toBeInTheDocument();
		expect(screen.getByText("Iris Innovation")).toBeInTheDocument();
		expect(screen.getByText("Ivan Innovation")).toBeInTheDocument();
	});
});
