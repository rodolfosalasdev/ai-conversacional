import { getConversation } from "@/server/store/conversation-store";
import { handleRouteError, jsonMessage, jsonOk } from "@/server/http/json";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const record = await getConversation(id);

    if (!record) return jsonMessage("Conversa não encontrada.", 404);

    return jsonOk({
      conversation: {
        id: record.id,
        client: record.client,
        state: record.state,
        messages: record.messages,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
