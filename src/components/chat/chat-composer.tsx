"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";

import { ModeSwitcher } from "@/components/chat/mode-switcher";
import { Button } from "@/components/ui/button";
import { uploadFiles } from "@/lib/api-client";
import { MODE_CONFIG } from "@/lib/prompts/system";
import { cn } from "@/lib/utils";
import type { Attachment, ChatMode } from "@/lib/types/chat";

export interface ChatComposerHandle {
  setValue: (value: string) => void;
}

export function ChatComposer({
  mode,
  onModeChange,
  onSubmit,
  sending,
  disabled,
  draft,
  onDraftChange,
}: {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSubmit: (text: string, attachments: Attachment[]) => void;
  sending: boolean;
  disabled?: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Cresce com o conteúdo até um teto, como o composer do Cursor.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [draft]);

  const canSend = draft.trim().length > 0 && !sending && !disabled;

  function submit() {
    if (!canSend) return;
    onSubmit(draft.trim(), attachments);
    onDraftChange("");
    setAttachments([]);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const result = await uploadFiles(Array.from(files));
      setAttachments((previous) => [...previous, ...result.attachments]);
      toast.success(
        result.attachments.length === 1
          ? `"${result.attachments[0].name}" anexado.`
          : `${result.attachments.length} arquivos anexados.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao anexar o arquivo."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="px-4 pb-4">
      <div
        className={cn(
          "rounded-2xl border border-border bg-card shadow-sm transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background py-1 pr-1 pl-2 text-xs"
              >
                <Paperclip className="size-3 text-muted-foreground" aria-hidden />
                <span className="max-w-40 truncate">{attachment.name}</span>
                <button
                  type="button"
                  aria-label={`Remover ${attachment.name}`}
                  onClick={() =>
                    setAttachments((previous) =>
                      previous.filter((item) => item.id !== attachment.id)
                    )
                  }
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          disabled={disabled}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? "Jornada encerrada — inicie uma nova conversa."
              : "Descreva o que você precisa ou responda a pergunta acima…"
          }
          className={cn(
            "w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-sm leading-relaxed",
            "placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          )}
        />

        <div className="flex items-center justify-between gap-2 px-2 pt-0.5 pb-2">
          <div className="flex min-w-0 items-center gap-0.5">
            <ModeSwitcher mode={mode} onChange={onModeChange} disabled={sending} />
            <span className="h-4 w-px bg-border" />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Anexar arquivo"
              disabled={uploading || disabled}
              onClick={() => fileInputRef.current?.click()}
              className="text-muted-foreground hover:text-foreground"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Paperclip className="size-3.5" aria-hidden />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {MODE_CONFIG[mode].description}
            </span>
            <Button
              size="icon-sm"
              aria-label="Enviar mensagem"
              disabled={!canSend}
              onClick={submit}
              className="rounded-lg"
            >
              {sending ? (
                <Square className="size-3 fill-current" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Enter envia · Shift + Enter quebra linha · arraste arquivos para anexar
      </p>
    </div>
  );
}
