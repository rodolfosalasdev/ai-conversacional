import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface KnowledgeChunk {
  id: string;
  docId: string;
  title: string;
  source: string;
  tags: string[];
  /** Cabeçalho da seção de onde o trecho veio. */
  heading: string;
  text: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  source: string;
  tags: string[];
  chunkCount: number;
  characters: number;
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge-base");

let cache: { chunks: KnowledgeChunk[]; docs: KnowledgeDoc[] } | null = null;

export async function loadKnowledgeBase() {
  if (cache && process.env.NODE_ENV === "production") return cache;

  const entries = await readdir(KNOWLEDGE_DIR).catch(() => [] as string[]);
  const files = entries.filter((file) => file.endsWith(".md"));

  const chunks: KnowledgeChunk[] = [];
  const docs: KnowledgeDoc[] = [];

  for (const file of files) {
    const raw = await readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
    const { frontMatter, body } = parseFrontMatter(raw);
    const docId = file.replace(/\.md$/, "");

    const title = frontMatter.title ?? docId;
    const source = frontMatter.source ?? "Base de conhecimento interna";
    const tags = frontMatter.tags ?? [];

    const docChunks = chunkByHeading(body).map((chunk, index) => ({
      id: `${docId}#${index}`,
      docId,
      title,
      source,
      tags,
      heading: chunk.heading,
      text: chunk.text,
    }));

    chunks.push(...docChunks);
    docs.push({
      id: docId,
      title,
      source,
      tags,
      chunkCount: docChunks.length,
      characters: body.length,
    });
  }

  cache = { chunks, docs };
  return cache;
}

interface FrontMatter {
  title?: string;
  source?: string;
  tags?: string[];
}

/** Parser mínimo de front matter: só title, source e tags em lista inline. */
function parseFrontMatter(raw: string): {
  frontMatter: FrontMatter;
  body: string;
} {
  if (!raw.startsWith("---")) return { frontMatter: {}, body: raw };

  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontMatter: {}, body: raw };

  const header = raw.slice(3, end);
  const body = raw.slice(end + 4).trimStart();
  const frontMatter: FrontMatter = {};

  for (const line of header.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    if (key === "tags") {
      frontMatter.tags = value
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else if (key === "title" || key === "source") {
      frontMatter[key] = value.trim();
    }
  }

  return { frontMatter, body };
}

/**
 * Quebra o documento por cabeçalho `##`. Seções longas viram vários pedaços
 * para que o trecho citado caiba no contexto do modelo.
 */
function chunkByHeading(body: string) {
  const lines = body.split("\n");
  const sections: { heading: string; lines: string[] }[] = [];
  let current = { heading: "Introdução", lines: [] as string[] };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMatch) {
      if (current.lines.join("").trim()) sections.push(current);
      current = { heading: headingMatch[1].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.join("").trim()) sections.push(current);

  const MAX_CHARS = 900;
  const chunks: { heading: string; text: string }[] = [];

  for (const section of sections) {
    const text = section.lines.join("\n").trim();
    if (!text) continue;

    if (text.length <= MAX_CHARS) {
      chunks.push({ heading: section.heading, text });
      continue;
    }

    const paragraphs = text.split(/\n{2,}/);
    let buffer = "";
    for (const paragraph of paragraphs) {
      if ((buffer + paragraph).length > MAX_CHARS && buffer) {
        chunks.push({ heading: section.heading, text: buffer.trim() });
        buffer = "";
      }
      buffer += `${paragraph}\n\n`;
    }
    if (buffer.trim()) {
      chunks.push({ heading: section.heading, text: buffer.trim() });
    }
  }

  return chunks;
}
