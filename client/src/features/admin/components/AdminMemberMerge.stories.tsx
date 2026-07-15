import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import type {
	MemberDuplicateCandidate,
	MemberMergeRequest,
} from "@/features/admin/adminTypes";
import { AdminDuplicateCandidatesPanel } from "./AdminDuplicateCandidatesPanel";
import { AdminMemberMergeDialog } from "./AdminMemberMergeDialog";

const duplicateCandidate: MemberDuplicateCandidate = {
	id: "duplicate-1",
	match_key: "name_dob:ada-president:1995-01-01",
	reason: "Same name and date of birth",
	confidence: "high",
	members: [
		{
			user_id: "11111111-1111-4111-8111-111111111111",
			email: "ada@tum.de",
			given_name: "Ada",
			surname: "President",
			date_of_birth: "1995-01-01",
			member_status: "active",
			active: true,
			department: "Legal & Finance",
			batch: "WS22",
			created_at: "2024-01-01T00:00:00Z",
		},
		{
			user_id: "22222222-2222-4222-8222-222222222222",
			email: "ada@gmail.com",
			given_name: "Ada",
			surname: "President",
			date_of_birth: "1995-01-01",
			member_status: "active",
			active: true,
			department: "Legal & Finance",
			batch: "WS22",
			created_at: "2025-01-01T00:00:00Z",
		},
	],
};

interface MergeStoryProps {
	onMerge: (request: MemberMergeRequest) => void;
}

function MergeStory({ onMerge }: MergeStoryProps) {
	const [candidate, setCandidate] = useState<MemberDuplicateCandidate | null>(
		null,
	);
	const [targetUserId, setTargetUserId] = useState("");
	const [sourceUserId, setSourceUserId] = useState("");
	const [note, setNote] = useState("");

	useEffect(() => {
		setTargetUserId(candidate?.members[0]?.user_id ?? "");
		setSourceUserId(candidate?.members[1]?.user_id ?? "");
		setNote("");
	}, [candidate]);

	const canMerge = Boolean(
		candidate && targetUserId && sourceUserId && targetUserId !== sourceUserId,
	);

	return (
		<div className="max-w-4xl">
			<AdminDuplicateCandidatesPanel
				candidates={[duplicateCandidate]}
				onOpenMerge={setCandidate}
			/>
			<AdminMemberMergeDialog
				candidate={candidate}
				targetUserId={targetUserId}
				setTargetUserId={setTargetUserId}
				sourceUserId={sourceUserId}
				setSourceUserId={setSourceUserId}
				note={note}
				setNote={setNote}
				openMergeDialog={setCandidate}
				closeMergeDialog={() => setCandidate(null)}
				canMerge={canMerge}
				mergeSelectedMembers={async () => {
					onMerge({
						source_user_id: sourceUserId,
						target_user_id: targetUserId,
						note,
					});
					setCandidate(null);
				}}
				isMergingMembers={false}
			/>
		</div>
	);
}

const meta = {
	title: "Features/Admin/MemberMerge",
	component: MergeStory,
	parameters: { layout: "padded" },
	args: { onMerge: fn() },
} satisfies Meta<typeof MergeStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DuplicateCandidateFlow: Story = {
	render: (args) => <MergeStory onMerge={args.onMerge} />,
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(document.body);

		await expect(
			canvas.getByRole("heading", { name: /possible duplicate members/i }),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Merge" }));

		const dialog = await body.findByRole("dialog", {
			name: /merge duplicate members/i,
		});
		await userEvent.type(
			within(dialog).getByLabelText(/audit note/i),
			"Same person",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /merge members/i }),
		);

		await expect(args.onMerge).toHaveBeenCalledWith({
			source_user_id: "22222222-2222-4222-8222-222222222222",
			target_user_id: "11111111-1111-4111-8111-111111111111",
			note: "Same person",
		});
	},
};
