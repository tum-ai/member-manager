import { MEMBER_ROLES, MEMBER_STATUSES } from "@member-manager/shared";
import { z } from "zod";

// Domain types, constants, and pure helpers now live in @member-manager/shared
// (single source of truth for client + server). Re-export them so existing
// server imports from "../lib/memberMetadata.js" keep working.
export * from "@member-manager/shared";

// Zod schemas stay here: they are server-side validation built on the shared
// enums. Keeping a single zod instance (the server's) avoids cross-package
// `instanceof ZodError` mismatches in the error handler.
export const memberRoleSchema = z.enum(MEMBER_ROLES);
export const memberStatusSchema = z.enum(MEMBER_STATUSES);
