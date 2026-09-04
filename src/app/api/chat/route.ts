import { chatRequestSchema } from "@/lib/schemas/chat";
import { runTurn } from "@/server/chat/orchestrator";
import {
  getConversation,
  saveConversation,
} from "@/server/store/conversation-store";
import { handleRouteError, jsonMessage, jsonOk } from "@/server/http/json";

export const maxDuration = 60;

/** Turno de conversa: interpreta a entrada, caminha o grafo e devolve as mensagens. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonMessage("Payload inválido", 422, parsed.error.flatten());
    }

    const record = await getConversation(parsed.data.conversationId);
    if (!record) return jsonMessage("Conversa não encontrada.", 404);

    if (record.state.finished && parsed.data.mode === "agent") {
      return jsonMessage(
        "Esta jornada já foi encerrada. Inicie uma nova conversa para contratar novamente.",
        409
      );
    }

    const turn = await runTurn({
      record,
      input: parsed.data.input,
      mode: parsed.data.mode,
      model: parsed.data.model,
      attachments: parsed.data.attachments,
    });

    const saved = await saveConversation(turn.record);

    return jsonOk({
      messages: turn.newMessages,
      state: saved.state,
      meta: turn.meta,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
