import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

export interface MemberCvMetadata {
	id: string;
	version: number;
	source: "application" | "member_upload" | "admin_upload";
	original_filename: string;
	size_bytes: number;
	mime_type: string;
	sha256: string;
	uploaded_at: string;
	is_current: boolean;
}

interface CvResponse {
	cv: MemberCvMetadata | null;
}

interface ConsentResponse {
	partner_sharing_consent_at: string | null;
}

// Read a base64 data URL from a File for JSON upload (mirrors the receipt flow).
function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
		reader.readAsDataURL(file);
	});
}

export function useMemberCv(userId: string) {
	const queryClient = useQueryClient();

	const cvQuery = useQuery({
		queryKey: ["member-cv", userId],
		queryFn: async () =>
			(await apiClient(`/api/members/${userId}/cv`, {
				method: "GET",
			})) as CvResponse,
	});

	const consentQuery = useQuery({
		queryKey: ["member-cv-consent", userId],
		queryFn: async () =>
			(await apiClient(`/api/members/${userId}/cv/consent`, {
				method: "GET",
			})) as ConsentResponse,
	});

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			const dataUrl = await fileToBase64(file);
			return (await apiClient(`/api/members/${userId}/cv`, {
				method: "POST",
				body: JSON.stringify({ filename: file.name, cv_base64: dataUrl }),
			})) as CvResponse;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["member-cv", userId] });
		},
	});

	const consentMutation = useMutation({
		mutationFn: async (consent: boolean) =>
			(await apiClient(`/api/members/${userId}/cv/consent`, {
				method: "PUT",
				body: JSON.stringify({ consent }),
			})) as ConsentResponse,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["member-cv-consent", userId],
			});
		},
	});

	// CV bytes are not JSON; fetch with the auth token and return a Blob.
	const fetchCvBlob = async (): Promise<Blob> => {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		const response = await fetch(
			`/api/members/${userId}/cv/current/download?download=1`,
			{
				headers: session?.access_token
					? { Authorization: `Bearer ${session.access_token}` }
					: {},
			},
		);
		if (!response.ok) {
			throw new Error("Failed to download CV");
		}
		return response.blob();
	};

	return {
		cv: cvQuery.data?.cv ?? null,
		isLoading: cvQuery.isLoading,
		error: cvQuery.error,
		consentAt: consentQuery.data?.partner_sharing_consent_at ?? null,
		isConsentLoading: consentQuery.isLoading,
		uploadCv: uploadMutation.mutateAsync,
		isUploading: uploadMutation.isPending,
		uploadError: uploadMutation.error,
		setConsent: consentMutation.mutateAsync,
		isSavingConsent: consentMutation.isPending,
		fetchCvBlob,
	};
}
