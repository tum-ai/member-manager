import {
	addLogoToDocument,
	addSignatureBlock,
	type BoardMember,
	createPdfDocument,
	formatGermanDate,
	getTodayGermanDate,
	PDF_COLORS,
} from "../../../lib/pdfUtils";
import type { Member } from "../../../types";

export interface MembershipProofOptions {
	president?: BoardMember;
	vicePresident?: BoardMember;
}

export async function generateMembershipProofPdf(
	member: Member,
	options: MembershipProofOptions = {},
): Promise<Blob> {
	const { doc, pageWidth, margin, maxWidth } = createPdfDocument();

	const salutation = member.salutation ? `${member.salutation} ` : "";
	const fullName = `${member.given_name} ${member.surname}`;
	const birthDate = formatGermanDate(member.date_of_birth);
	const today = getTodayGermanDate();

	let y = 10;

	await addLogoToDocument(doc, pageWidth, y);

	y = 50;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(22);
	doc.setTextColor(
		PDF_COLORS.primary[0],
		PDF_COLORS.primary[1],
		PDF_COLORS.primary[2],
	);
	doc.text("CERTIFICATE OF MEMBERSHIP", pageWidth / 2, y, { align: "center" });

	y = 70;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(12);
	doc.setTextColor(PDF_COLORS.text[0], PDF_COLORS.text[1], PDF_COLORS.text[2]);
	doc.text("This is to certify that:", margin, y);

	y = 85;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(16);
	doc.text(`${salutation} ${fullName}`, pageWidth / 2, y, { align: "center" });

	y = 98;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(12);
	doc.text(`Born on: ${birthDate}`, pageWidth / 2, y, { align: "center" });

	y = 120;
	doc.setLineHeightFactor(1.6);
	const statement = `The person named above is a registered member of TUM.ai e.V., actively contributing to our AI-focused student initiative at the Technical University of Munich. As a member, they participate in projects, events, and initiatives that shape the future of artificial intelligence.`;
	const wrappedStatement = doc.splitTextToSize(statement, maxWidth);
	doc.text(wrappedStatement, margin, y);

	y += wrappedStatement.length * 7 + 25;

	doc.setFont("helvetica", "bold");
	doc.text("About TUM.ai", margin, y);
	y += 8;

	doc.setFont("helvetica", "normal");
	const aboutText = `TUM.ai is a non-profit student initiative around Artificial Intelligence (AI) based at the Technical University of Munich (TUM). Shaping and empowering the AI ecosystem, TUM.ai runs projects focused on real-world problems, organizes its signature hackathon, hosts events and workshops, and supports funding AI startups.`;
	const wrappedAbout = doc.splitTextToSize(aboutText, maxWidth);
	doc.text(wrappedAbout, margin, y);

	y += wrappedAbout.length * 7 + 20;

	doc.setFontSize(11);
	doc.text(`Issued on: ${today}`, margin, y);

	y += 25;

	addSignatureBlock(doc, y, margin, pageWidth, {
		president: options.president,
		vicePresident: options.vicePresident,
		date: today,
	});

	return doc.output("blob");
}
