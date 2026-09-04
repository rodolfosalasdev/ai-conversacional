import { createConversationSchema } from "@/lib/schemas/chat";
import { CLIENT_PRESETS, DEFAULT_CLIENT } from "@/lib/mocks/client";
import { runTurn } from "@/server/chat/orchestrator";
import {
  createConversation,
  saveConversation,
} from "@/server/store/conversation-store";
import { handleRouteError, jsonCreated, jsonMessage } from "@/server/http/json";
import type { ClientProfile } from "@/lib/types/financing";

/** Abre uma conversa já com o cadastro carregado e dispara o primeiro turno. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonMessage("Payload inválido", 422, parsed.error.flatten());
    }

    const client = resolveClient(parsed.data);
    const record = createConversation(client);

    const turn = await runTurn({
      record,
      input: { kind: "start" },
      mode: "agent",
      model: "gpt",
    });

    const saved = await saveConversation(turn.record);

    return jsonCreated({
      conversation: {
        id: saved.id,
        client: saved.client,
        state: saved.state,
        messages: saved.messages,
      },
      meta: turn.meta,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function resolveClient(
  data: ReturnType<typeof createConversationSchema.parse>
): ClientProfile {
  if (data.clientPresetId) {
    const preset = CLIENT_PRESETS.find(
      (item) => item.id === data.clientPresetId
    );
    if (preset) return preset.profile;
  }

  if (data.client) {
    return {
      ...DEFAULT_CLIENT,
      ...data.client,
      occupation: data.client.occupation ?? DEFAULT_CLIENT.occupation,
      employer: data.client.employer ?? DEFAULT_CLIENT.employer,
      relationshipYears:
        data.client.relationshipYears ?? DEFAULT_CLIENT.relationshipYears,
    };
  }

  return DEFAULT_CLIENT;
}
