import type { FastifyReply } from "fastify";

export function sendPdf(
	reply: FastifyReply,
	pdf: Buffer,
	filename: string,
	disposition: "attachment" | "inline",
) {
	return reply
		.header("Content-Type", "application/pdf")
		.header("Content-Disposition", `${disposition}; filename="${filename}"`)
		.send(pdf);
}
