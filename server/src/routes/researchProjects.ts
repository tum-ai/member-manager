import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DatabaseError } from "../lib/errors.js";
import { authenticate } from "../middleware/auth.js";

const DEFAULT_RESEARCH_PROJECTS_URL = "https://www.tum-ai.com/api/getResearch";

const innovationProjects = [
	{
		id: "women-at-tum-ai",
		title: "Women@TUM.ai",
		description:
			"Female empowerment, mentorship, and leadership across AI, business, and tech.",
		detailedDescription:
			"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative. The task force focuses on empowerment, leadership, mentorship, workshops, networking, and industry collaboration.",
		image: "/assets/innovation/women_at_tumai.jpg",
	},
	{
		id: "med-ai",
		title: "med.AI",
		description:
			"Biomedical AI research and community-building with partners across Munich.",
		detailedDescription:
			"med.AI is a multidisciplinary team dedicated to advancing artificial intelligence in the medical domain. It brings together a biomedical AI community in Munich and works on research projects with Helmholtz Center Munich, including a pan-cancer histopathology atlas, digital pathology foundation tools, retinal OCT segmentation for biomarker discovery in gene therapy, and prediction of switching events in PDR5-GFP gene expression.",
		image: "/assets/innovation/med_ai.webp",
	},
	{
		id: "quantum-ai",
		title: "quanTUM.ai",
		description:
			"Machine learning for quantum science, from algorithms and simulation to experimental workflows.",
		detailedDescription:
			"quanTUM.ai focuses on applying machine learning across the quantum stack, including quantum algorithms, simulation, high-performance computing, and experimental workflows. Through research projects, educational sessions, community events, and hackathons, the task force bridges AI and quantum technologies in a practical, interdisciplinary way.",
		image: "",
	},
	{
		id: "generative-modelling",
		title: "Generative Modelling",
		description:
			"Educational deep dives into the math and PyTorch behind modern generative models.",
		detailedDescription:
			"The Generative Modelling task force creates educational sessions for the TUM.ai community that unpack the mathematics and PyTorch code behind models such as ChatGPT and Stable Diffusion.",
		image: "",
	},
	{
		id: "global-affairs",
		title: "Global Affairs",
		description:
			"International outreach through expeditions, conferences, partnerships, and strategic ecosystem building.",
		detailedDescription:
			"Global Affairs drives TUM.ai's international presence by organizing expeditions to leading AI and venture hubs worldwide. The task force attends major conferences, connects with startups and research labs, builds partnerships, and acquires grants to open doors to new ecosystems for TUM.ai members.",
		image: "",
	},
] as const;

const ResearchProjectSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		publication: z.string().optional().default(""),
		status: z.string().optional().default("Unknown"),
		keywords: z.string().optional().default(""),
	})
	.passthrough();

function getResearchProjectsUrl(): string {
	return (
		process.env.WEBSITE_RESEARCH_API_URL?.trim() ||
		DEFAULT_RESEARCH_PROJECTS_URL
	);
}

export async function researchProjectRoutes(server: FastifyInstance) {
	server.get(
		"/innovation-projects",
		{ preHandler: authenticate },
		async () => innovationProjects,
	);

	server.get(
		"/research-projects",
		{ preHandler: authenticate },
		async (request, _reply) => {
			try {
				const response = await fetch(getResearchProjectsUrl(), {
					headers: {
						accept: "application/json",
					},
				});

				if (!response.ok) {
					request.log.error(
						{ status: response.status },
						"Failed to fetch website research projects",
					);
					throw new DatabaseError();
				}

				const payload = await response.json();
				const projects = z.array(ResearchProjectSchema).parse(payload);

				return projects.map((project) => ({
					id: project.id,
					title: project.title.trim(),
					description: project.description.trim(),
					image: project.image.trim(),
					publication: project.publication.trim(),
					status: project.status.trim(),
					keywords: project.keywords.trim(),
				}));
			} catch (error) {
				if (error instanceof DatabaseError) {
					throw error;
				}
				request.log.error({ err: error }, "Failed to load research projects");
				throw new DatabaseError();
			}
		},
	);
}
