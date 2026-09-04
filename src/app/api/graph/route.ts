import { FINANCING_NODES } from "@/lib/graph/financing-graph";
import { layoutGraph } from "@/lib/graph/layout";
import { handleRouteError, jsonOk } from "@/server/http/json";

/** Definição e layout do grafo — a UI desenha a partir daqui. */
export async function GET() {
  try {
    return jsonOk({ nodes: FINANCING_NODES, layout: layoutGraph() });
  } catch (error) {
    return handleRouteError(error);
  }
}
