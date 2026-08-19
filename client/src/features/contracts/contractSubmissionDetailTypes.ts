import type {
	ContractPartnerComment,
	ContractReviewStatus,
	ContractStatusEvent,
	ContractSubmission,
} from "@member-manager/shared";

export interface ContractSubmissionDetailViewModel {
	id: string | undefined;
	submission: ContractSubmission | undefined;
	submissionLoading: boolean;
	submissionError: Error | null;
	title: string;
	editedText: string;
	notes: string;
	clarificationMessage: string;
	rejectReason: string;
	internalComment: string;
	boardSignatureData: string | null;
	boardSignerName: string;
	partnerEmailSubject: string;
	partnerEmailMessage: string;
	downloadError: string | null;
	downloading: boolean;
	isContractsAdmin: boolean;
	isBoardMember: boolean;
	previewPages: string[] | undefined;
	previewLoading: boolean;
	isDocxDocument: boolean;
	documentStatus: string | null;
	storedPdfUrl: string | null;
	storedPdfLoading: boolean;
	storedPdfError: Error | null;
	docxDownloading: boolean;
	docxDownloadError: string | null;
	docxUploadPending: boolean;
	docxUploadError: Error | null;
	pendingDocxFileName: string | null;
	busy: boolean;
	actionError: Error | null;
	comments: ContractPartnerComment[];
	commentsLoading: boolean;
	commentsError: Error | null;
	hasLegacyComment: boolean;
	statusEvents: ContractStatusEvent[];
	statusEventsLoading: boolean;
	formEntries: [string, unknown][];
	canEditDraft: boolean;
	canSendToPartner: boolean;
	canApprove: boolean;
	canRequestClarification: boolean;
	signUrl: string | null;
	finalPdfUrl: string | null;
	boardSignUrl: string | null;
	resendConfirmationOpen: boolean;
	setEditedText: (value: string) => void;
	setNotes: (value: string) => void;
	setClarificationMessage: (value: string) => void;
	setRejectReason: (value: string) => void;
	setInternalComment: (value: string) => void;
	setBoardSignatureData: (value: string | null) => void;
	setBoardSignerName: (value: string) => void;
	setPartnerEmailSubject: (value: string) => void;
	setPartnerEmailMessage: (value: string) => void;
	setManualStatus: (status: ContractReviewStatus) => void;
	setAutoSendAfterBoardSigned: (enabled: boolean) => void;
	confirmResend: () => void;
	cancelResend: () => void;
	saveChanges: () => void;
	downloadPdf: () => Promise<void>;
	downloadDocx: () => Promise<void>;
	requestDocxUpload: (file: File) => void;
	cancelDocxUpload: () => void;
	confirmDocxUpload: () => void;
	sendToPartner: () => void;
	sendEmailToPartner: () => void;
	sendWithOpenSign: () => void;
	approve: () => void;
	requestClarification: () => void;
	reject: () => void;
	addInternalReply: () => void;
	boardSign: () => void;
	generateBoardSigningLink: () => void;
	finalize: () => void;
}
