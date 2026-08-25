import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ContractSignatureInput,
	SignBodySchema,
} from "@member-manager/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import {
	fetchPublicBoardSignPayload,
	fetchPublicBoardSignPdf,
	postPublicBoardSignature,
} from "@/features/contracts/contractApi";
import { contractQueryKeys } from "@/features/contracts/contractQueryKeys";
import type { ContractBoardSignPageViewModel } from "@/features/contracts/publicSigningTypes";
import { useBlobObjectUrl } from "./useBlobObjectUrl";

export function useContractBoardSignPage(): ContractBoardSignPageViewModel {
	const { token } = useParams<{ token: string }>();
	const [submitted, setSubmitted] = useState(false);
	const signatureForm = useForm<ContractSignatureInput>({
		resolver: zodResolver(SignBodySchema),
		defaultValues: { signer_name: "", signature_data: "" },
	});
	const payloadQuery = useQuery({
		queryKey: contractQueryKeys.publicBoardSign(token),
		enabled: Boolean(token),
		retry: false,
		queryFn: () => fetchPublicBoardSignPayload(token ?? ""),
	});
	const hasStoredPdf = Boolean(payloadQuery.data?.pdf_url);
	const pdfQuery = useQuery({
		queryKey: contractQueryKeys.publicBoardSignPdf(token),
		enabled: Boolean(token) && hasStoredPdf,
		retry: false,
		queryFn: () => fetchPublicBoardSignPdf(token ?? ""),
	});
	const pdfUrl = useBlobObjectUrl(pdfQuery.data);
	const signMutation = useMutation({
		mutationFn: (values: ContractSignatureInput) =>
			postPublicBoardSignature(token ?? "", values),
		onSuccess: () => setSubmitted(true),
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
		signatureForm,
		signing: signMutation.isPending,
		signError: signMutation.error,
		setSignatureData: (dataUrl) =>
			signatureForm.setValue("signature_data", dataUrl ?? "", {
				shouldDirty: true,
				shouldValidate: true,
			}),
		submitSignature: (values) => signMutation.mutate(values),
	};
}
