import { zodResolver } from "@hookform/resolvers/zod";
import {
	type JobPostingFormInput,
	type JobPostingInput,
	type JobPostingRequest,
	jobPostingInputSchema,
} from "@member-manager/shared";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import {
	emptyAdminJobForm,
	jobRequestToForm,
} from "@/features/admin/adminJobRequestsUtils";
import { getMemberDisplayName } from "@/features/admin/adminRequests";
import { useAdminData } from "@/hooks/useAdminData";

export function useAdminJobRequests() {
	const { showToast } = useToast();
	const adminData = useAdminData();
	const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
	const [editingJob, setEditingJob] = useState<JobPostingRequest | null>(null);
	const [actionIds, setActionIds] = useState(() => new Set<string>());
	const editorSessionRef = useRef(0);

	const form = useForm<JobPostingFormInput, unknown, JobPostingInput>({
		resolver: zodResolver(jobPostingInputSchema),
		defaultValues: emptyAdminJobForm,
	});

	const members = adminData.members ?? [];
	const pendingJobs = adminData.jobRequests.filter(
		(request) => request.status === "pending",
	);
	const managedJobs = adminData.jobRequests.filter(
		(request) =>
			request.source !== "partner_portal" && request.status !== "pending",
	);

	function requesterName(request: JobPostingRequest): string {
		if (request.source === "partner_portal") return "Partner Portal";
		if (!request.user_id) return "Admin";
		return getMemberDisplayName(members, request.user_id);
	}

	function setActionPending(requestId: string, isPending: boolean) {
		setActionIds((currentIds) => {
			const nextIds = new Set(currentIds);
			if (isPending) nextIds.add(requestId);
			else nextIds.delete(requestId);
			return nextIds;
		});
	}

	async function reviewJob(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		setActionPending(requestId, true);
		try {
			await adminData.reviewJobRequestAsync({ requestId, decision });
			showToast(`Job request ${decision}`, "success");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to review job request: ${message}`, "error");
		} finally {
			setActionPending(requestId, false);
		}
	}

	async function removeJob(request: JobPostingRequest) {
		if (!window.confirm(`Remove "${request.title}" from the job postings?`)) {
			return;
		}

		setActionPending(request.id, true);
		try {
			await adminData.removeJobRequestAsync(request.id);
			showToast("Job posting removed", "success");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to remove job posting: ${message}`, "error");
		} finally {
			setActionPending(request.id, false);
		}
	}

	function openCreate() {
		editorSessionRef.current += 1;
		setEditingJob(null);
		setEditorMode("create");
		form.reset(emptyAdminJobForm);
	}

	function openEdit(request: JobPostingRequest) {
		if (request.source === "partner_portal") return;
		editorSessionRef.current += 1;
		setEditingJob(request);
		setEditorMode("edit");
		form.reset(jobRequestToForm(request));
	}

	function resetEditor() {
		setEditorMode(null);
		setEditingJob(null);
		form.reset(emptyAdminJobForm);
	}

	function closeEditor() {
		if (adminData.isSavingJob) return;
		editorSessionRef.current += 1;
		resetEditor();
	}

	const submitEditor = form.handleSubmit(async (payload) => {
		const submittedSession = editorSessionRef.current;
		try {
			if (editorMode === "edit" && editingJob) {
				await adminData.updateJobAsync({
					requestId: editingJob.id,
					payload,
				});
				showToast("Job posting updated", "success");
			} else {
				await adminData.createJobAsync(payload);
				showToast("Job posting published", "success");
			}
			if (editorSessionRef.current === submittedSession) {
				editorSessionRef.current += 1;
				resetEditor();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to save job posting: ${message}`, "error");
		}
	});

	return {
		...adminData,
		pendingJobs,
		managedJobs,
		requesterName,
		actionIds,
		editorMode,
		form,
		openCreate,
		openEdit,
		closeEditor,
		submitEditor,
		reviewJob,
		removeJob,
	};
}
