import { MAX_CV_BYTES } from "@member-manager/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberCvMetadata } from "@/hooks/useMemberCv";
import { CvPanel } from "./CvPanel";

const showToast = vi.fn();
const downloadPdfBlob = vi.fn();

let cv: MemberCvMetadata | null = null;
let isLoading = false;
let hasConsent = false;
let isConsentLoading = false;
let isConsentError = false;
let isUploading = false;
const uploadCv = vi.fn();
const fetchCvBlob = vi.fn();

vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));
vi.mock("../../lib/pdfUtils", () => ({
	downloadPdfBlob: (...args: unknown[]) => downloadPdfBlob(...args),
}));
vi.mock("../../hooks/useMemberCv", () => ({
	useMemberCv: () => ({
		cv,
		isLoading,
		hasConsent,
		isConsentLoading,
		isConsentError,
		uploadCv,
		isUploading,
		fetchCvBlob,
	}),
}));

const sampleCv: MemberCvMetadata = {
	id: "cv-1",
	version: 2,
	source: "member_upload",
	original_filename: "ada-cv.pdf",
	size_bytes: 2048,
	mime_type: "application/pdf",
	sha256: "abc",
	uploaded_at: "2026-01-15T10:00:00.000Z",
	is_current: true,
};

beforeEach(() => {
	vi.clearAllMocks();
	cv = null;
	isLoading = false;
	hasConsent = false;
	isConsentLoading = false;
	isConsentError = false;
	isUploading = false;
	uploadCv.mockResolvedValue(undefined);
	fetchCvBlob.mockResolvedValue(new Blob(["pdf"]));
});

function getFileInput(): HTMLInputElement {
	const input = document.querySelector('input[type="file"]');
	if (!input) throw new Error("file input not found");
	return input as HTMLInputElement;
}

describe("CvPanel", () => {
	it("shows the loading skeleton while the CV query is pending", () => {
		isLoading = true;
		render(<CvPanel userId="user-1" />);
		expect(screen.getByLabelText(/loading cv/i)).toBeInTheDocument();
	});

	it("renders the empty state and an Upload action when no CV exists", () => {
		render(<CvPanel userId="user-1" />);
		expect(screen.getByText(/no cv on record yet/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /upload cv/i }),
		).toBeInTheDocument();
	});

	it("renders CV metadata, a Replace action, and downloads on click", async () => {
		const userEv = userEvent.setup();
		cv = sampleCv;
		render(<CvPanel userId="user-1" />);

		expect(screen.getByText("ada-cv.pdf")).toBeInTheDocument();
		expect(screen.getByText(/uploaded by you/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /replace cv/i }),
		).toBeInTheDocument();

		await userEv.click(screen.getByRole("button", { name: /download/i }));

		await waitFor(() => expect(fetchCvBlob).toHaveBeenCalledTimes(1));
		expect(downloadPdfBlob).toHaveBeenCalledWith(
			expect.any(Blob),
			"ada-cv.pdf",
		);
	});

	it("toasts when the download fails", async () => {
		const userEv = userEvent.setup();
		cv = sampleCv;
		fetchCvBlob.mockRejectedValue(new Error("download exploded"));
		render(<CvPanel userId="user-1" />);

		await userEv.click(screen.getByRole("button", { name: /download/i }));

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith("download exploded", "error"),
		);
		expect(downloadPdfBlob).not.toHaveBeenCalled();
	});

	it("uploads a valid PDF and toasts success", async () => {
		render(<CvPanel userId="user-1" />);
		const file = new File(["pdf"], "cv.pdf", { type: "application/pdf" });

		fireEvent.change(getFileInput(), { target: { files: [file] } });

		await waitFor(() => expect(uploadCv).toHaveBeenCalledWith(file));
		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("current version"),
			"success",
		);
	});

	it("accepts a .pdf file even when the browser reports an empty MIME type", async () => {
		render(<CvPanel userId="user-1" />);
		const file = new File(["pdf"], "resume.PDF", { type: "" });

		fireEvent.change(getFileInput(), { target: { files: [file] } });

		await waitFor(() => expect(uploadCv).toHaveBeenCalledWith(file));
	});

	it("does nothing when no file is selected", () => {
		render(<CvPanel userId="user-1" />);
		fireEvent.change(getFileInput(), { target: { files: [] } });
		expect(uploadCv).not.toHaveBeenCalled();
	});

	it("rejects non-PDF files", () => {
		render(<CvPanel userId="user-1" />);
		const file = new File(["x"], "cv.png", { type: "image/png" });

		fireEvent.change(getFileInput(), { target: { files: [file] } });

		expect(uploadCv).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"Please upload a PDF file.",
			"error",
		);
	});

	it("rejects files larger than the maximum size", () => {
		render(<CvPanel userId="user-1" />);
		const file = new File(["x"], "big.pdf", { type: "application/pdf" });
		Object.defineProperty(file, "size", { value: MAX_CV_BYTES + 1 });

		fireEvent.change(getFileInput(), { target: { files: [file] } });

		expect(uploadCv).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			expect.stringContaining("too large"),
			"error",
		);
	});

	it("toasts when the upload fails", async () => {
		uploadCv.mockRejectedValue(new Error("upload exploded"));
		render(<CvPanel userId="user-1" />);
		const file = new File(["pdf"], "cv.pdf", { type: "application/pdf" });

		fireEvent.change(getFileInput(), { target: { files: [file] } });

		await waitFor(() =>
			expect(showToast).toHaveBeenCalledWith("upload exploded", "error"),
		);
	});

	it("opens the native file picker when the upload button is clicked", async () => {
		const userEv = userEvent.setup();
		render(<CvPanel userId="user-1" />);
		const clickSpy = vi.spyOn(getFileInput(), "click");

		await userEv.click(screen.getByRole("button", { name: /upload cv/i }));

		expect(clickSpy).toHaveBeenCalled();
	});

	it("shows the partner-sharing consent message when consent is granted", () => {
		hasConsent = true;
		render(<CvPanel userId="user-1" />);
		expect(
			screen.getByText(/may be shared with tum\.ai partners/i),
		).toBeInTheDocument();
	});

	it("shows the not-shared message when consent is missing", () => {
		hasConsent = false;
		render(<CvPanel userId="user-1" />);
		expect(
			screen.getByText(/your cv is not shared with tum\.ai partners/i),
		).toBeInTheDocument();
	});

	it("hides the consent block while consent is loading", () => {
		isConsentLoading = true;
		render(<CvPanel userId="user-1" />);
		expect(screen.queryByText(/tum\.ai partners/i)).not.toBeInTheDocument();
	});

	it("hides the consent block when the consent query errored", () => {
		isConsentError = true;
		render(<CvPanel userId="user-1" />);
		expect(screen.queryByText(/tum\.ai partners/i)).not.toBeInTheDocument();
	});

	it("falls back to the raw source label for unknown sources", () => {
		cv = { ...sampleCv, source: "weird_source" as MemberCvMetadata["source"] };
		render(<CvPanel userId="user-1" />);
		expect(screen.getByText("weird_source")).toBeInTheDocument();
	});

	it("renders the raw date string when it cannot be parsed", () => {
		cv = { ...sampleCv, uploaded_at: "not-a-date" };
		render(<CvPanel userId="user-1" />);
		expect(screen.getByText(/not-a-date/)).toBeInTheDocument();
	});

	it("formats byte sizes across B, KB and MB ranges", () => {
		cv = { ...sampleCv, size_bytes: 512 };
		const { rerender } = render(<CvPanel userId="user-1" />);
		expect(screen.getByText(/512 B/)).toBeInTheDocument();

		cv = { ...sampleCv, size_bytes: 5 * 1024 * 1024 };
		rerender(<CvPanel userId="user-1" />);
		expect(screen.getByText(/5\.0 MB/)).toBeInTheDocument();
	});
});
