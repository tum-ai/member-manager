import type {
	ContractCommentInput,
	ContractSignatureInput,
	PublicBoardSignPayload,
	PublicSignPayload,
} from "@member-manager/shared";
import type { UseFormReturn } from "react-hook-form";

export interface PublicDocumentViewModel {
	pdfUrl: string | null;
	pdfLoading: boolean;
	pdfError: Error | null;
	documentStatus: string | null;
}

export interface ContractSignPageViewModel extends PublicDocumentViewModel {
	payload: PublicSignPayload | undefined;
	loading: boolean;
	loadError: Error | null;
	submitted: boolean;
	commentSubmitted: boolean;
	signatureForm: UseFormReturn<ContractSignatureInput>;
	commentForm: UseFormReturn<ContractCommentInput>;
	signing: boolean;
	commenting: boolean;
	signError: Error | null;
	commentError: Error | null;
	setSignatureData: (dataUrl: string | null) => void;
	submitSignature: (values: ContractSignatureInput) => void;
	submitComment: (values: ContractCommentInput) => void;
}

export interface ContractBoardSignPageViewModel
	extends PublicDocumentViewModel {
	payload: PublicBoardSignPayload | undefined;
	loading: boolean;
	loadError: Error | null;
	submitted: boolean;
	signatureForm: UseFormReturn<ContractSignatureInput>;
	signing: boolean;
	signError: Error | null;
	setSignatureData: (dataUrl: string | null) => void;
	submitSignature: (values: ContractSignatureInput) => void;
}
