import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { BATCH_OPTIONS } from "@/lib/constants";
import type { MemberSchema } from "@/lib/schemas";
import type { ResearchProject } from "@/types";
import { TumaiProfileSection } from "./TumaiProfileSection";

const ids = {
	batch: "batch",
	department: "department",
	role: "role",
	researchProject: "research-project",
	reimbursementNotifications: "reimbursement-notifications",
};

const researchProjects: ResearchProject[] = [
	{
		id: "p1",
		title: "Alpha Research",
		description: "",
		status: "ongoing",
	} as ResearchProject,
];

function Harness({
	isAdmin = false,
	currentRole = "Member",
	currentDepartment = "Software Development",
	isResearchDepartmentSelected = false,
	researchProjectSelectValue = "",
}: Partial<React.ComponentProps<typeof TumaiProfileSection>>) {
	const memberForm = useForm<MemberSchema>({
		defaultValues: {
			active: true,
			member_role: currentRole,
			department: currentDepartment,
			batch: "",
			degree: "",
			school: "",
			research_project_id: "",
		} as Partial<MemberSchema> as MemberSchema,
	});
	return (
		<TumaiProfileSection
			memberForm={memberForm}
			isAdmin={isAdmin}
			currentRole={currentRole}
			currentDepartment={currentDepartment}
			isResearchDepartmentSelected={isResearchDepartmentSelected}
			isLoadingResearchProjects={false}
			researchProjectOptions={researchProjects}
			researchProjectSelectValue={researchProjectSelectValue}
			ids={ids}
		/>
	);
}

describe("TumaiProfileSection", () => {
	it("renders department and role as read-only inputs for non-admins", () => {
		render(<Harness isAdmin={false} />);

		const department = screen.getByLabelText(/department/i);
		expect(department).toBeDisabled();
		expect(department).toHaveValue("Software Development");
		expect(
			screen.getByText(/departments are assigned by admins/i),
		).toBeInTheDocument();
	});

	it("renders editable department and role selects for admins", async () => {
		const user = userEvent.setup();
		render(<Harness isAdmin />);

		await user.click(screen.getByLabelText(/department/i));
		expect(
			await screen.findByRole("option", { name: "Research" }),
		).toBeInTheDocument();
	});

	it("renders the research-project picker only when research is selected", () => {
		const { rerender } = render(<Harness />);
		expect(
			screen.queryByLabelText(/research project/i),
		).not.toBeInTheDocument();

		rerender(<Harness isResearchDepartmentSelected />);
		expect(screen.getByLabelText(/research project/i)).toBeInTheDocument();
	});

	it("lets the user pick a batch", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const batch = BATCH_OPTIONS[0];
		await user.click(screen.getByLabelText(/batch/i));
		await user.click(await screen.findByRole("option", { name: batch }));

		expect(screen.getByLabelText(/batch/i)).toHaveTextContent(batch);
	});

	it("lets members opt in to reimbursement Slack DMs", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const toggle = screen.getByRole("switch", {
			name: /reimbursement slack dms/i,
		});
		expect(toggle).not.toBeChecked();

		await user.click(toggle);

		expect(toggle).toBeChecked();
	});
});
