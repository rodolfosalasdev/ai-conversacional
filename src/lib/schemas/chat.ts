import { z } from "zod";

export const chatModeSchema = z.enum(["agent", "plan", "ask", "web"]);
export const modelIdSchema = z
  .enum(["gpt", "sonnet"])
  .transform((value) => (value === "sonnet" ? "gpt" : value));

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
  excerpt: z.string().optional(),
});

export const turnInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start") }),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(4000) }),
  z.object({ kind: z.literal("choice"), optionId: z.string().min(1) }),
]);

export const chatRequestSchema = z.object({
  conversationId: z.string().min(1),
  mode: chatModeSchema,
  model: modelIdSchema,
  input: turnInputSchema,
  attachments: z.array(attachmentSchema).max(6).optional(),
});

export const createConversationSchema = z.object({
  clientPresetId: z.string().optional(),
  client: z
    .object({
      fullName: z.string().min(3),
      cpf: z.string().min(11),
      email: z.string().email(),
      phone: z.string().min(10),
      monthlyIncome: z.number().positive(),
      monthlyDebts: z.number().min(0),
      creditScore: z.number().min(0).max(1000),
      occupation: z.string().optional(),
      employer: z.string().optional(),
      relationshipYears: z.number().min(0).optional(),
    })
    .optional(),
});

export const knowledgeSearchSchema = z.object({
  query: z.string().min(2).max(500),
  topK: z.number().min(1).max(10).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type CreateConversationRequest = z.infer<typeof createConversationSchema>;
