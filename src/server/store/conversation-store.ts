import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createConversationState } from "@/lib/graph/engine";
import { DEFAULT_CLIENT } from "@/lib/mocks/client";
import type { ChatMessage, ConversationState } from "@/lib/types/chat";
import type { ClientProfile } from "@/lib/types/financing";

export interface ConversationRecord {
  id: string;
  client: ClientProfile;
  state: ConversationState;
  messages: ChatMessage[];
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const PERSIST = process.env.CONVERSATION_PERSIST !== "0";

/**
 * Map em memória sobrevive ao hot reload do Next via globalThis, e o snapshot
 * em disco permite inspecionar/retomar uma jornada entre reinícios.
 */
const globalStore = globalThis as unknown as {
  __conversationStore?: Map<string, ConversationRecord>;
};

const store =
  globalStore.__conversationStore ??
  (globalStore.__conversationStore = new Map<string, ConversationRecord>());

export function createConversation(client?: ClientProfile): ConversationRecord {
  const id = randomUUID();
  const record: ConversationRecord = {
    id,
    client: client ?? DEFAULT_CLIENT,
    state: createConversationState(id),
    messages: [],
    updatedAt: new Date().toISOString(),
  };

  store.set(id, record);
  void persist(record);
  return record;
}

export async function getConversation(
  id: string
): Promise<ConversationRecord | null> {
  const cached = store.get(id);
  if (cached) return cached;

  if (!PERSIST) return null;

  try {
    const raw = await readFile(conversationPath(id), "utf8");
    const record = JSON.parse(raw) as ConversationRecord;
    store.set(id, record);
    return record;
  } catch {
    return null;
  }
}

export async function saveConversation(record: ConversationRecord) {
  const updated = { ...record, updatedAt: new Date().toISOString() };
  store.set(record.id, updated);
  await persist(updated);
  return updated;
}

function conversationPath(id: string) {
  return path.join(DATA_DIR, "conversations", `${id}.json`);
}

async function persist(record: ConversationRecord) {
  if (!PERSIST) return;
  try {
    await mkdir(path.join(DATA_DIR, "conversations"), { recursive: true });
    await writeFile(
      conversationPath(record.id),
      JSON.stringify(record, null, 2),
      "utf8"
    );
  } catch {
    // Persistência é conveniência: em ambiente somente-leitura seguimos em memória.
  }
}

// -- Contratos ---------------------------------------------------------------

const globalContracts = globalThis as unknown as {
  __contractHtml?: Map<string, { html: string; text: string; subject: string }>;
};

const contractHtml =
  globalContracts.__contractHtml ??
  (globalContracts.__contractHtml = new Map());

export async function saveContractDocument(params: {
  id: string;
  html: string;
  text: string;
  subject: string;
}) {
  contractHtml.set(params.id, {
    html: params.html,
    text: params.text,
    subject: params.subject,
  });

  if (!PERSIST) return;
  try {
    await mkdir(path.join(DATA_DIR, "outbox"), { recursive: true });
    await writeFile(
      path.join(DATA_DIR, "outbox", `${params.id}.html`),
      params.html,
      "utf8"
    );
  } catch {
    // idem
  }
}

export async function getContractDocument(id: string) {
  const cached = contractHtml.get(id);
  if (cached) return cached;

  try {
    const html = await readFile(
      path.join(DATA_DIR, "outbox", `${id}.html`),
      "utf8"
    );
    return { html, text: "", subject: "Contrato" };
  } catch {
    return null;
  }
}
