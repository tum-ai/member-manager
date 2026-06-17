import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { generateMembershipProofPdf } from "@/features/certificate/generators/membershipProofPdf";
import { downloadPdfBlob } from "@/lib/pdfUtils";
import type { Member } from "@/types";

interface UseMembershipProofResult {
	isGeneratingPdf: boolean;
	handleDownloadMembershipProof: () => Promise<void>;
}

export function useMembershipProof(
	member: Member | null | undefined,
): UseMembershipProofResult {
	const { showToast } = useToast();
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

	const handleDownloadMembershipProof = async (): Promise<void> => {
		if (!member || isGeneratingPdf) return;

		setIsGeneratingPdf(true);
		try {
			const pdfBlob = await generateMembershipProofPdf(member);
			const safeGivenName = member.given_name.replace(/[^a-zA-Z0-9-_]/g, "-");
			const safeSurname = member.surname.replace(/[^a-zA-Z0-9-_]/g, "-");
			const fullName = `${safeGivenName}-${safeSurname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Membership_Proof_${fullName}.pdf`);
			showToast("Membership proof downloaded!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to generate PDF: ${errorMessage}`, "error");
		} finally {
			setIsGeneratingPdf(false);
		}
	};

	return { isGeneratingPdf, handleDownloadMembershipProof };
}
