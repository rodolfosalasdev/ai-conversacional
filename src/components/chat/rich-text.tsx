import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * Renderiza o subconjunto de Markdown que o assistente usa: **negrito**,
 * `código`, listas com "-" e parágrafos. Evita trazer uma lib inteira para isso.
 */
export function RichText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");

  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 ml-4 list-disc space-y-1">
        {listBuffer.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  const flushParagraph = (key: string) => {
    if (paragraphBuffer.length === 0) return;
    blocks.push(
      <p key={key} className="whitespace-pre-wrap">
        {renderInline(paragraphBuffer.join("\n"))}
      </p>
    );
    paragraphBuffer = [];
  };

  lines.forEach((line, index) => {
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);

    if (listMatch) {
      flushParagraph(`p-${index}`);
      listBuffer.push(listMatch[1]);
      return;
    }

    if (!line.trim()) {
      flushList(`ul-${index}`);
      flushParagraph(`p-${index}`);
      return;
    }

    flushList(`ul-${index}`);
    paragraphBuffer.push(line);
  });

  flushList("ul-end");
  flushParagraph("p-end");

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}
