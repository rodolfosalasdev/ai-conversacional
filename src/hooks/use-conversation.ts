"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createConversation,
  sendTurn,
  type ConversationPayload,
  type TurnMeta,
} from "@/lib/api-client";
import type {
  Attachment,
  ChatMessage,
  ChatMode,
  ConversationState,
  ModelId,
} from "@/lib/types/chat";
import type { ClientProfile } from "@/lib/types/financing";

export function useConversation() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [state, setState] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<TurnMeta | null>(null);
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);

  const [mode, setMode] = useState<ChatMode>("agent");
  const model: ModelId = "gpt";

  // Evita disparar duas conversas no Strict Mode do desenvolvimento.
  const bootstrapped = useRef(false);

  const applyConversation = useCallback((payload: ConversationPayload) => {
    setConversationId(payload.id);
    setClient(payload.client);
    setState(payload.state);
    setMessages(payload.messages);
  }, []);

  const start = useCallback(
    async (presetId?: string) => {
      setBooting(true);
      try {
        const { conversation, meta: turnMeta } =
          await createConversation(presetId);
        applyConversation(conversation);
        setMeta(turnMeta);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível iniciar a conversa."
        );
      } finally {
        setBooting(false);
      }
    },
    [applyConversation]
  );

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void start();
  }, [start]);

  const submit = useCallback(
    async (
      input: { kind: "text"; text: string } | { kind: "choice"; optionId: string },
      options?: { attachments?: Attachment[]; optimisticLabel?: string }
    ) => {
      if (!conversationId || sending) return;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticContent =
        input.kind === "text" ? input.text : (options?.optimisticLabel ?? "");

      setMessages((previous) => [
        ...previous.map((message) =>
          input.kind === "choice" && message.options?.length && !message.chosenOptionId
            ? { ...message, chosenOptionId: input.optionId }
            : message
        ),
        {
          id: optimisticId,
          role: "user",
          content: optimisticContent,
          createdAt: new Date().toISOString(),
          mode,
          model,
          attachments: options?.attachments,
        },
        {
          id: `${optimisticId}-pending`,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          mode,
          model,
          pending: true,
        },
      ]);

      setSending(true);

      try {
        const response = await sendTurn({
          conversationId,
          mode,
          model,
          input,
          attachments: options?.attachments,
        });

        setMessages((previous) => [
          ...previous.filter(
            (message) =>
              message.id !== optimisticId && message.id !== `${optimisticId}-pending`
          ),
          ...response.messages,
        ]);
        setState(response.state);
        setMeta(response.meta);
      } catch (error) {
        setMessages((previous) =>
          previous.filter((message) => message.id !== `${optimisticId}-pending`)
        );
        toast.error(
          error instanceof Error ? error.message : "Falha ao enviar a mensagem."
        );
      } finally {
        setSending(false);
      }
    },
    [conversationId, mode, model, sending]
  );

  const sendText = useCallback(
    (text: string, attachments?: Attachment[]) =>
      submit({ kind: "text", text }, { attachments }),
    [submit]
  );

  const chooseOption = useCallback(
    (optionId: string, label: string) =>
      submit({ kind: "choice", optionId }, { optimisticLabel: label }),
    [submit]
  );

  return {
    conversationId,
    client,
    state,
    messages,
    meta,
    booting,
    sending,
    mode,
    setMode,
    model,
    sendText,
    chooseOption,
    restart: start,
  };
}
