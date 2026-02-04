import {
	addLogoToDocument,
	type BoardMember,
	createPdfDocument,
	DEFAULT_BOARD_MEMBERS,
	formatGermanDate,
	getTodayGermanDate,
	PDF_COLORS,
} from "../../../lib/pdfUtils";
import type { EngagementSchema } from "../../../lib/schemas";
import type { Member } from "../../../types";

export interface EngagementCertificateOptions {
	president?: BoardMember;
	vicePresident?: BoardMember;
}

export async function generateEngagementCertificatePdf(
	member: Member,
	engagements: EngagementSchema[],
	options: EngagementCertificateOptions = {},
): Promise<Blob> {
	const { doc, pageWidth, pageHeight, margin, maxWidth } = createPdfDocument();
	const maxY = pageHeight - margin;

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
	doc.text("CERTIFICATE", pageWidth / 2, y, { align: "center" });

	y = 70;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(12);
	doc.setTextColor(PDF_COLORS.text[0], PDF_COLORS.text[1], PDF_COLORS.text[2]);
	doc.setLineHeightFactor(1.5);

	const intro = `We hereby acknowledge that ${fullName}, born on ${birthDate}, participated in and contributed to the TUM.ai student initiative during the following periods.`;
	const wrappedIntro = doc.splitTextToSize(intro.trim(), maxWidth);
	doc.text(wrappedIntro, margin, y);
	y += wrappedIntro.length * 7 + 10;

	const col1Width = 40;
	const col2Width = 50;
	const col3Width = maxWidth - col1Width - col2Width - 10;

	const colX1 = margin;
	const colX2 = colX1 + col1Width + 5;
	const colX3 = colX2 + col2Width + 5;

	doc.setFont("helvetica", "bold");
	doc.text("Time Period", colX1, y);
	doc.text("Department", colX2, y);
	doc.text("Tasks", colX3, y);
	y += 8;

	doc.setFont("helvetica", "normal");

	for (const engagement of engagements) {
		const formatMonthYear = (dateStr: string) => {
			const date = new Date(dateStr);
			if (Number.isNaN(date.getTime())) {
				if (import.meta.env.DEV) {
					console.warn(`Invalid date string encountered: ${dateStr}`);
				}
				return "Invalid Date";
			}
			return date.toLocaleDateString("de-DE", {
				year: "numeric",
				month: "2-digit",
			});
		};

		const start = formatMonthYear(engagement.startDate);
		const end = engagement.isStillActive
			? "Present"
			: formatMonthYear(engagement.endDate || "");

		const period = `${start} - ${end}`;
		const deptText = `${engagement.department}${engagement.isTeamLead ? " (Team Lead)" : ""}`;

		const tasks = engagement.tasksDescription
			.split("\n")
			.map((t) => t.trim())
			.filter(Boolean);

		const wrappedPeriod = doc.splitTextToSize(period, col1Width);
		const wrappedDept = doc.splitTextToSize(deptText, col2Width);

		const checkmark = "•";
		const checkmarkOffset = 5;
		const indentX = colX3 + checkmarkOffset;

		const formattedTasks: { check: boolean; line: string }[] = [];
		for (const task of tasks) {
			const wrapped = doc.splitTextToSize(
				task,
				col3Width - checkmarkOffset - 1,
			);
			if (wrapped.length > 0) {
				formattedTasks.push({ check: true, line: wrapped[0] });
				for (let i = 1; i < wrapped.length; i++) {
					formattedTasks.push({ check: false, line: wrapped[i] });
				}
			}
		}

		const lines = Math.max(
			wrappedPeriod.length,
			wrappedDept.length,
			formattedTasks.length,
		);
		const lineHeight = 6;

		for (let i = 0; i < lines; i++) {
			doc.setTextColor(
				PDF_COLORS.text[0],
				PDF_COLORS.text[1],
				PDF_COLORS.text[2],
			);

			if (wrappedPeriod[i]) doc.text(wrappedPeriod[i], colX1, y);
			if (wrappedDept[i]) doc.text(wrappedDept[i], colX2, y);

			const taskLine = formattedTasks[i];
			if (taskLine) {
				if (taskLine.check) {
					doc.setTextColor(
						PDF_COLORS.primary[0],
						PDF_COLORS.primary[1],
						PDF_COLORS.primary[2],
					);
					doc.text(checkmark, colX3, y);
					doc.setTextColor(
						PDF_COLORS.text[0],
						PDF_COLORS.text[1],
						PDF_COLORS.text[2],
					);
					doc.text(taskLine.line, colX3 + checkmarkOffset, y);
				} else {
					doc.text(taskLine.line, indentX, y);
				}
			}

			y += lineHeight;
			if (y > maxY) {
				doc.addPage();
				y = margin;
			}
		}

		y += 4;
	}

	const valueText = `For the active and continuous contribution to TUM.ai, a high level of responsibility, personal commitment, team-spirit and curiosity are indispensable.\n\nWe thank ${fullName} for ${member.salutation === "Ms." ? "her" : "his"} commitment and enriching contribution to TUM.ai.`;
	const wrappedValue = doc.splitTextToSize(valueText.trim(), maxWidth);
	doc.text(wrappedValue, margin, y);
	y += wrappedValue.length * 7 + 10;

	if (y + 30 > maxY) {
		doc.addPage();
		y = margin;
	}

	doc.setFontSize(11);
	doc.setFont("helvetica", "normal");

	const vp = options.vicePresident || DEFAULT_BOARD_MEMBERS.vicePresident;
	const pres = options.president || DEFAULT_BOARD_MEMBERS.president;

	doc.text(`${vp.name},`, margin, y);
	doc.text(vp.title, margin, y + 6);
	doc.text(`Munich, ${today}`, margin, y + 12);

	const rightX = pageWidth - margin - 60;
	doc.text(`${pres.name},`, rightX, y);
	doc.text(pres.title, rightX, y + 6);
	doc.text(`Munich, ${today}`, rightX, y + 12);

	y += 25;

	if (y + 40 > maxY) {
		doc.addPage();
		y = margin;
	}

	doc.setFont("helvetica", "bold");
	doc.setFontSize(10);
	doc.text("About TUM.ai", margin, y);
	y += 8;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(8);
	const aboutText = `TUM.ai is a non-profit student initiative around Artificial Intelligence (AI) based at the Technical University of Munich (TUM).\n\nShaping and empowering the AI ecosystem, TUM.ai runs projects focused on real-world problems, organizes its signature hackathon, hosts events and workshops, and supports funding AI startups.\n\nEach member shapes their TUM.ai journey by joining one of the departments to contribute to our growth, launching new initiatives, and participating in hands-on offerings.`;
	const wrappedAbout = doc.splitTextToSize(aboutText.trim(), maxWidth);
	doc.text(wrappedAbout, margin, y);
	y += wrappedAbout.length * 7 + 15;

	if (y > maxY) {
		doc.addPage();
		y = margin;
	}

	return doc.output("blob");
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
