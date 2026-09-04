import { loadKnowledgeBase } from "@/server/rag/knowledge-base";
import { handleRouteError, jsonOk } from "@/server/http/json";

/** Lista os documentos indexados na base de conhecimento. */
export async function GET() {
  try {
    const { docs, chunks } = await loadKnowledgeBase();

    return jsonOk({
      documents: docs,
      totals: { documents: docs.length, chunks: chunks.length },
      ragServiceUrl: process.env.RAG_SERVICE_URL ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
