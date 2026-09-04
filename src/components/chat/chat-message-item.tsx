"use client";

import { BookOpen, Bot, Paperclip } from "lucide-react";

import { BranchOptions } from "@/components/chat/branch-options";
import { MessageBlocks } from "@/components/chat/message-blocks";
import { RichText } from "@/components/chat/rich-text";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { NODE_BY_ID } from "@/lib/graph/financing-graph";
import { cn } from "@/lib/utils";
import type { BranchOption, ChatMessage, ChatMode } from "@/lib/types/chat";

export function ChatMessageItem({
  message,
  disabled,
  onChoose,
}: {
  message: ChatMessage;
  disabled?: boolean;
  onChoose: (option: BranchOption) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-1.5">
          <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>

          {message.attachments?.length ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((attachment) => (
                <Badge
                  key={attachment.id}
                  variant="secondary"
                  className="gap-1 text-[10px]"
                >
                  <Paperclip className="size-2.5" aria-hidden />
                  {attachment.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const node = message.nodeId ? NODE_BY_ID[message.nodeId] : undefined;

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
        {message.pending ? (
          <span className="flex gap-0.5">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </span>
        ) : (
          <Bot className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {node ? (
          <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {node.title}
          </p>
        ) : null}

        {message.pending ? (
          <p className="text-sm text-muted-foreground">Pensando…</p>
        ) : (
          <RichText content={message.content} />
        )}

        {message.blocks?.length ? (
          <MessageBlocks blocks={message.blocks} />
        ) : null}

        {message.citations?.length ? (
          <Citations citations={message.citations} mode={message.mode} />
        ) : null}

        {message.options?.length ? (
          <BranchOptions
            options={message.options}
            chosenOptionId={message.chosenOptionId}
            disabled={disabled}
            onChoose={onChoose}
          />
        ) : null}
      </div>
    </div>
  );
}

function Citations({
  citations,
  mode,
}: {
  citations: NonNullable<ChatMessage["citations"]>;
  mode?: ChatMode;
}) {
  const isWeb = mode === "web" || citations.some((citation) => citation.url);

  return (
    <Accordion className="mt-3">
      <AccordionItem
        value="citations"
        className="rounded-xl border border-border bg-muted/30 px-3"
      >
        <AccordionTrigger className="py-2 text-xs hover:no-underline">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-muted-foreground" aria-hidden />
            {citations.length}{" "}
            {isWeb ? "fontes da web" : "trechos da base de conhecimento"}
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-2 pb-3">
          {citations.map((citation) => (
            <div
              key={`${citation.docId}-${citation.title}`}
              className="rounded-lg border border-border bg-background p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                {citation.url ? (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium hover:underline"
                  >
                    {citation.title}
                  </a>
                ) : (
                  <p className="text-xs font-medium">{citation.title}</p>
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {(citation.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-1 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
                {citation.snippet}
              </p>
              <p className="mt-1.5 truncate text-[10px] text-muted-foreground/70">
                {citation.url ?? citation.source}
              </p>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className={cn("size-1 animate-bounce rounded-full bg-muted-foreground")}
      style={{ animationDelay: delay }}
    />
  );
}
