import { getContractDocument } from "@/server/store/conversation-store";
import { handleRouteError, jsonMessage } from "@/server/http/json";

/** Renderiza o e-mail exatamente como o cliente recebeu. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const document = await getContractDocument(id);

    if (!document) return jsonMessage("Contrato não encontrado.", 404);

    return new Response(document.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
