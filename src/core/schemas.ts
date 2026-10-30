import { z } from "zod";
import { MAX_TURN_CHARS } from "./types";

export const PatientFieldsSchema = z.object({
  name: z.string().min(1),
  dob: z.iso.date(),
  mrn: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  medications: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
});

export const PatientContextSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  fields: PatientFieldsSchema,
});

export const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_TURN_CHARS, `A history turn can be at most ${MAX_TURN_CHARS} characters`),
});

// What the host hands us. Auth already happened upstream; `role` is trusted as-is.
export const PipelineRequestSchema = z.object({
  requestId: z.string().min(1),
  role: z.string().min(1),
  message: z.string().min(1).max(8000),
  patient: PatientContextSchema,
  history: z.array(ChatTurnSchema).max(20).optional(),
});

export type PatientFields = z.infer<typeof PatientFieldsSchema>;
export type PatientContext = z.infer<typeof PatientContextSchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;
export type PipelineRequest = z.infer<typeof PipelineRequestSchema>;
