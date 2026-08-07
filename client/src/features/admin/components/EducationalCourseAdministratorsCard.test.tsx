import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMember } from "@/features/admin/adminUtils";
import { EducationalCourseAdministratorsCard } from "./EducationalCourseAdministratorsCard";

const showToast = vi.fn();

vi.mock("@/contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

function member(overrides: Partial<AdminMember>): AdminMember {
	return {
		user_id: "10000000-0000-4000-8000-000000000001",
		given_name: "Alex",
		surname: "Member",
		email: "alex@example.com",
		active: true,
		member_status: "active",
		educational_course_role: null,
		...overrides,
	} as AdminMember;
}

describe("EducationalCourseAdministratorsCard", () => {
	beforeEach(() => {
		showToast.mockClear();
	});

	it("assigns an active member as educational course administrator", async () => {
		const user = userEvent.setup();
		const onSetAdministrator = vi.fn().mockResolvedValue(undefined);
		render(
			<EducationalCourseAdministratorsCard
				members={[
					member({
						user_id: "10000000-0000-4000-8000-000000000002",
						given_name: "Taylor",
						surname: "Teacher",
					}),
				]}
				isUpdating={false}
				onSetAdministrator={onSetAdministrator}
			/>,
		);

		await user.type(screen.getByLabelText("Add administrator"), "Taylor");
		await user.click(screen.getByRole("button", { name: "Add" }));

		await waitFor(() =>
			expect(onSetAdministrator).toHaveBeenCalledWith({
				userId: "10000000-0000-4000-8000-000000000002",
				enabled: true,
			}),
		);
		expect(showToast).toHaveBeenCalledWith(
			"Educational course administrator added.",
			"success",
		);
	});

	it("removes an existing educational course administrator", async () => {
		const user = userEvent.setup();
		const onSetAdministrator = vi.fn().mockResolvedValue(undefined);
		render(
			<EducationalCourseAdministratorsCard
				members={[
					member({
						given_name: "Jordan",
						surname: "Planner",
						educational_course_role: "administrator",
					}),
				]}
				isUpdating={false}
				onSetAdministrator={onSetAdministrator}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Remove Jordan Planner as educational course administrator",
			}),
		);

		await waitFor(() =>
			expect(onSetAdministrator).toHaveBeenCalledWith({
				userId: "10000000-0000-4000-8000-000000000001",
				enabled: false,
			}),
		);
	});

	it("keeps inactive administrators visible so their role can be removed", async () => {
		const user = userEvent.setup();
		const onSetAdministrator = vi.fn().mockResolvedValue(undefined);
		render(
			<EducationalCourseAdministratorsCard
				members={[
					member({
						given_name: "Former",
						surname: "Planner",
						active: false,
						member_status: "inactive",
						educational_course_role: "administrator",
					}),
				]}
				isUpdating={false}
				onSetAdministrator={onSetAdministrator}
			/>,
		);

		expect(screen.getByText("Inactive")).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", {
				name: "Remove Former Planner as educational course administrator",
			}),
		);
		expect(onSetAdministrator).toHaveBeenCalledWith({
			userId: "10000000-0000-4000-8000-000000000001",
			enabled: false,
		});
	});
});
