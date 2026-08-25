import { zodResolver } from "@hookform/resolvers/zod";
import {
	CommentBodySchema,
	type ContractCommentInput,
	type ContractSignatureInput,
	SignBodySchema,
} from "@member-manager/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import {
	fetchPublicSignPayload,
	fetchPublicSignPdf,
	postPublicComment,
	postPublicSignature,
} from "@/features/contracts/contractApi";
import { contractQueryKeys } from "@/features/contracts/contractQueryKeys";
import type { ContractSignPageViewModel } from "@/features/contracts/publicSigningTypes";
import { useBlobObjectUrl } from "./useBlobObjectUrl";

export function useContractSignPage(): ContractSignPageViewModel {
	const { token } = useParams<{ token: string }>();
	const [submitted, setSubmitted] = useState(false);
	const [commentSubmitted, setCommentSubmitted] = useState(false);
	const signatureForm = useForm<ContractSignatureInput>({
		resolver: zodResolver(SignBodySchema),
		defaultValues: { signer_name: "", signature_data: "" },
	});
	const commentForm = useForm<ContractCommentInput>({
		resolver: zodResolver(CommentBodySchema),
		defaultValues: { comment: "" },
	});

	const payloadQuery = useQuery({
		queryKey: contractQueryKeys.publicSign(token),
		enabled: Boolean(token),
		retry: false,
		queryFn: () => fetchPublicSignPayload(token ?? ""),
	});
	const hasStoredPdf = Boolean(payloadQuery.data?.pdf_url);
	const pdfQuery = useQuery({
		queryKey: contractQueryKeys.publicSignPdf(token),
		enabled: Boolean(token) && hasStoredPdf,
		retry: false,
		queryFn: () => fetchPublicSignPdf(token ?? ""),
	});
	const pdfUrl = useBlobObjectUrl(pdfQuery.data);

	const signMutation = useMutation({
		mutationFn: (values: ContractSignatureInput) =>
			postPublicSignature(token ?? "", values),
		onSuccess: () => setSubmitted(true),
	});
	const commentMutation = useMutation({
		mutationFn: (values: ContractCommentInput) =>
			postPublicComment(token ?? "", values),
		onSuccess: () => setCommentSubmitted(true),
	});

	return {
		payload: payloadQuery.data,
		loading: Boolean(token) && payloadQuery.isLoading,
		loadError:
			payloadQuery.error ?? (!token ? new Error("Invalid signing link") : null),
		pdfUrl,
		pdfLoading: pdfQuery.isLoading || pdfQuery.isFetching,
		pdfError: pdfQuery.error,
		documentStatus: payloadQuery.data?.document_status ?? null,
		submitted,
		commentSubmitted,
		signatureForm,
		commentForm,
		signing: signMutation.isPending,
		commenting: commentMutation.isPending,
		signError: signMutation.error,
		commentError: commentMutation.error,
		setSignatureData: (dataUrl) =>
			signatureForm.setValue("signature_data", dataUrl ?? "", {
				shouldDirty: true,
				shouldValidate: true,
			}),
		submitSignature: (values) => signMutation.mutate(values),
		submitComment: (values) => commentMutation.mutate(values),
	};
}
