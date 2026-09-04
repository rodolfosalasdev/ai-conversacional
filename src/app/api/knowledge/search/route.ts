import { knowledgeSearchSchema } from "@/lib/schemas/chat";
import { searchKnowledge } from "@/server/rag/client";
import { handleRouteError, jsonMessage, jsonOk } from "@/server/http/json";

/** Busca no RAG. Usa o serviço Python quando disponível; senão, BM25 local. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = knowledgeSearchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonMessage("Payload inválido", 422, parsed.error.flatten());
    }

    const result = await searchKnowledge(
      parsed.data.query,
      parsed.data.topK ?? 4
    );

    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
