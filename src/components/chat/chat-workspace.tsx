"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  GitBranch,
  Library,
  Database,
  RotateCcw,
  UserRound,
} from "lucide-react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageItem } from "@/components/chat/chat-message-item";
import { ClientPanel } from "@/components/chat/client-panel";
import { ContractPanel } from "@/components/chat/contract-panel";
import { GraphPanel } from "@/components/chat/graph-panel";
import { KnowledgePanel } from "@/components/chat/knowledge-panel";
import { PromptLibraryPanel } from "@/components/chat/prompt-library-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConversation } from "@/hooks/use-conversation";
import { fetchHealth, type HealthPayload } from "@/lib/api-client";
import type { Attachment, ChatMode } from "@/lib/types/chat";

export function ChatWorkspace() {
  const conversation = useConversation();
  const [draft, setDraft] = useState("");
  const [health, setHealth] = useState<HealthPayload | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Mantém a última mensagem visível conforme a conversa cresce.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [conversation.messages]);

  function handleSubmit(text: string, attachments: Attachment[]) {
    void conversation.sendText(text, attachments);
  }

  function handlePrompt(prompt: string, mode: ChatMode) {
    conversation.setMode(mode);
    setDraft(prompt);
  }

  const finished = conversation.state?.finished ?? false;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Painel esquerdo: cadastro pré-carregado e biblioteca de prompts */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border lg:flex">
        <Tabs defaultValue="client" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-3 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="client" className="flex-1 gap-1.5 text-xs">
                <UserRound className="size-3.5" aria-hidden />
                Cliente
              </TabsTrigger>
              <TabsTrigger value="prompts" className="flex-1 gap-1.5 text-xs">
                <Library className="size-3.5" aria-hidden />
                Prompts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="client"
            className="thin-scrollbar min-h-0 flex-1 overflow-y-auto"
          >
            <ClientPanel
              client={conversation.client}
              disabled={conversation.sending || conversation.booting}
              onSelectPreset={(presetId) => void conversation.restart(presetId)}
            />
          </TabsContent>

          <TabsContent value="prompts" className="min-h-0 flex-1">
            <PromptLibraryPanel onApply={handlePrompt} />
          </TabsContent>
        </Tabs>
      </aside>

      {/* Centro: conversa */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="thin-scrollbar min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {conversation.booting ? (
              <BootingSkeleton />
            ) : (
              conversation.messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  disabled={conversation.sending}
                  onChoose={(option) =>
                    void conversation.chooseOption(option.id, option.label)
                  }
                />
              ))
            )}

            {finished ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void conversation.restart()}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Iniciar uma nova contratação
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <ChatComposer
            mode={conversation.mode}
            onModeChange={conversation.setMode}
            onSubmit={handleSubmit}
            sending={conversation.sending}
            disabled={conversation.booting || (finished && conversation.mode === "agent")}
            draft={draft}
            onDraftChange={setDraft}
          />
        </div>
      </main>

      {/* Painel direito: grafo, base de conhecimento e contrato */}
      <aside className="hidden w-84 shrink-0 flex-col border-l border-border xl:flex">
        <Tabs defaultValue="graph" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-3 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="graph" className="flex-1 gap-1.5 text-xs">
                <GitBranch className="size-3.5" aria-hidden />
                Grafo
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="flex-1 gap-1.5 text-xs">
                <Database className="size-3.5" aria-hidden />
                RAG
              </TabsTrigger>
              <TabsTrigger value="contract" className="flex-1 gap-1.5 text-xs">
                <FileText className="size-3.5" aria-hidden />
                Contrato
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="graph" className="min-h-0 flex-1">
            <GraphPanel state={conversation.state} />
          </TabsContent>

          <TabsContent value="knowledge" className="min-h-0 flex-1">
            <KnowledgePanel ragEngine={health?.rag.engine} />
          </TabsContent>

          <TabsContent value="contract" className="min-h-0 flex-1">
            <ContractPanel state={conversation.state} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}

function BootingSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="size-7 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="grid gap-2 pt-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
