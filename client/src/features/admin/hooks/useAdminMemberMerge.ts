import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import type {
	MemberDuplicateCandidate,
	MemberMergeRequest,
	MemberMergeResponse,
} from "@/features/admin/adminTypes";

interface UseAdminMemberMergeParams {
	mergeMembersAsync: (
		request: MemberMergeRequest,
	) => Promise<MemberMergeResponse>;
	isMergingMembers: boolean;
}

export function useAdminMemberMerge({
	mergeMembersAsync,
	isMergingMembers,
}: UseAdminMemberMergeParams) {
	const { showToast } = useToast();
	const [candidate, setCandidate] = useState<MemberDuplicateCandidate | null>(
		null,
	);
	const [targetUserId, setTargetUserId] = useState("");
	const [sourceUserId, setSourceUserId] = useState("");
	const [note, setNote] = useState("");

	useEffect(() => {
		const first = candidate?.members[0]?.user_id ?? "";
		const second = candidate?.members[1]?.user_id ?? "";
		setTargetUserId(first);
		setSourceUserId(second);
		setNote("");
	}, [candidate]);

	const openMergeDialog = (nextCandidate: MemberDuplicateCandidate) => {
		setCandidate(nextCandidate);
	};

	const closeMergeDialog = () => {
		if (!isMergingMembers) {
			setCandidate(null);
		}
	};

	const canMerge = Boolean(
		candidate &&
			targetUserId &&
			sourceUserId &&
			targetUserId !== sourceUserId &&
			!isMergingMembers,
	);

	const mergeSelectedMembers = async () => {
		if (!canMerge) return;
		try {
			await mergeMembersAsync({
				source_user_id: sourceUserId,
				target_user_id: targetUserId,
				note,
			});
			showToast("Duplicate member merged.", "success");
			setCandidate(null);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unable to merge members.";
			showToast(message, "error");
		}
	};

	return {
		candidate,
		targetUserId,
		setTargetUserId,
		sourceUserId,
		setSourceUserId,
		note,
		setNote,
		openMergeDialog,
		closeMergeDialog,
		canMerge,
		mergeSelectedMembers,
		isMergingMembers,
	};
}
