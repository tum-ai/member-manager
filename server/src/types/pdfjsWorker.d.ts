/**
 * `pdf.worker.mjs` ships no type declarations. It is imported for its side
 * effect — it assigns `globalThis.pdfjsWorker` — so the shape is irrelevant;
 * what matters is that the specifier stays a literal that Vercel file tracing
 * can follow. See `lib/contracts/contractPdfAnchors.ts`.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
	export const WorkerMessageHandler: unknown;
}
